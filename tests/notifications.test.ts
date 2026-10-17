import { afterAll, afterEach, describe, expect, it, vi } from "vitest"
import { randomUUID } from "node:crypto"
import { createServer, type Socket } from "node:net"
import { getPrisma } from "@/lib/prisma"
import {
  enqueueUserNotification,
  enqueueAdminAlert,
  enqueueRightsHolderNotification,
} from "@/services/notifications/outbox"
import {
  claimNotifications,
  deliverNotification,
  reconcileSmsReceipts,
} from "@/services/notifications/worker"
import {
  normalizeGhanaPhone,
  requestPhoneCode,
  savePhoneSettings,
  verifyPhoneCode,
} from "@/services/notifications/phone"
import {
  sendSms,
  sendEmail,
  smsDeliveryReceipt,
} from "@/services/notifications/providers"
import {
  notificationQueue,
  resolveNotification,
} from "@/services/notifications/admin"
import { mutateCreatorContent } from "@/services/content/creator"
import { mutateAdmin } from "@/services/admin/operations"
const db = getPrisma()
const users: string[] = [],
  holders: string[] = [],
  contents: string[] = []
async function user(role: "ADMIN" | "VIEWER" | "RIGHTS_HOLDER" = "VIEWER") {
  const id = `notifications-${randomUUID()}`
  users.push(id)
  return db.user.create({
    data: { id, name: "Notification Test", email: `${id}@example.test`, role },
  })
}
async function queued(userId: string, eventKey = randomUUID()) {
  await db.$transaction((tx) =>
    enqueueUserNotification(tx, {
      userId,
      eventKey,
      event: { type: "WELCOME" },
    })
  )
  return db.notificationOutbox.findFirstOrThrow({
    where: { eventKey, recipientId: userId },
  })
}
const sent = {
  email: vi.fn(async () => ({
    status: "ACCEPTED" as const,
    messageId: "smtp-id",
  })),
  sms: vi.fn(async () => ({
    status: "ACCEPTED" as const,
    messageId: "sms-id",
  })),
}
const oldSecret = process.env.BETTER_AUTH_SECRET
afterEach(() => {
  vi.restoreAllMocks()
  sent.email.mockClear()
  sent.sms.mockClear()
  process.env.BETTER_AUTH_SECRET = oldSecret
})
afterAll(async () => {
  await db.content.deleteMany({ where: { id: { in: contents } } })
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } })
  await db.user.deleteMany({ where: { id: { in: users } } })
  await db.rightsHolder.deleteMany({ where: { id: { in: holders } } })
})

describe("transactional notification outbox", () => {
  it("queues publication changes through creator and admin transactions only when status changes", async () => {
    const owner = await user("RIGHTS_HOLDER"),
      a = await user("ADMIN")
    const holder = await db.rightsHolder.create({
      data: { name: `Publication ${randomUUID()}` },
    })
    holders.push(holder.id)
    await db.rightsHolderMembership.create({
      data: { userId: owner.id, rightsHolderId: holder.id },
    })
    const content = await db.content.create({
      data: {
        title: "Publication Fixture",
        slug: `publication-${randomUUID()}`,
        shortDescription: "Fixture",
        description: "Fixture",
        contentType: "MOVIE",
        publicationStatus: "PUBLISHED",
        rightsHolderId: holder.id,
      },
    })
    contents.push(content.id)
    const creatorUrl = new URL(
      `http://localhost:3000/api/creator/content/${content.id}/publication`
    )
    await mutateCreatorContent(
      creatorUrl,
      "PATCH",
      { status: "UNPUBLISHED" },
      owner.id
    )
    await mutateCreatorContent(
      creatorUrl,
      "PATCH",
      { status: "UNPUBLISHED" },
      owner.id
    )
    expect(
      await db.notificationOutbox.count({
        where: {
          recipientId: owner.id,
          eventKey: { startsWith: `publication:${content.id}:` },
        },
      })
    ).toBe(1)
    await db.content.update({
      where: { id: content.id },
      data: { publicationStatus: "PUBLISHED" },
    })
    await mutateAdmin(
      new URL(
        `http://localhost:3000/api/admin/content/${content.id}/publication`
      ),
      "PATCH",
      { status: "UNPUBLISHED" },
      a.id
    )
    expect(
      await db.notificationOutbox.count({
        where: {
          recipientId: owner.id,
          eventKey: { startsWith: `publication:${content.id}:` },
        },
      })
    ).toBe(2)
  })
  it("commits with the business transaction and deduplicates concurrent event/channel recipients", async () => {
    const u = await user()
    const eventKey = randomUUID()
    await Promise.all(
      Array.from({ length: 3 }, () =>
        db.$transaction((tx) =>
          enqueueUserNotification(tx, {
            userId: u.id,
            eventKey,
            event: { type: "WELCOME" },
          })
        )
      )
    )
    expect(await db.notificationOutbox.count({ where: { eventKey } })).toBe(1)
    await expect(
      db.$transaction(async (tx) => {
        await enqueueUserNotification(tx, {
          userId: u.id,
          eventKey: `rollback:${eventKey}`,
          event: { type: "WELCOME" },
        })
        throw Error("rollback")
      })
    ).rejects.toThrow("rollback")
    expect(
      await db.notificationOutbox.count({
        where: { eventKey: `rollback:${eventKey}` },
      })
    ).toBe(0)
  })
  it("requires verified consent for SMS and rechecks consent at delivery", async () => {
    const u = await user()
    await db.user.update({
      where: { id: u.id },
      data: {
        phone: "+233241234567",
        phoneVerifiedAt: new Date(),
        transactionalSmsConsent: true,
      },
    })
    const row = await queued(u.id)
    const sms = await db.notificationOutbox.findFirstOrThrow({
      where: { eventKey: row.eventKey, channel: "SMS" },
    })
    await db.notificationOutbox.update({
      where: { id: sms.id },
      data: { status: "PROCESSING", claimToken: "consent-test", attempts: 1 },
    })
    await db.user.update({
      where: { id: u.id },
      data: { transactionalSmsConsent: false },
    })
    expect(
      await deliverNotification(
        {
          ...sms,
          status: "PROCESSING",
          claimToken: "consent-test",
          attempts: 1,
        },
        sent
      )
    ).toBe("CANCELLED")
    expect(sent.sms).not.toHaveBeenCalled()
  })
  it("claims each message once under concurrent workers and records acceptance separately", async () => {
    const u = await user()
    const row = await queued(u.id)
    // Other test records are not due; this test owns the due window.
    await db.notificationOutbox.updateMany({
      where: {
        id: { not: row.id },
        recipientId: { in: users },
        status: "PENDING",
      },
      data: { nextAttemptAt: new Date(Date.now() + 86_400_000) },
    })
    const batches = await Promise.all([
      claimNotifications(1),
      claimNotifications(1),
    ])
    const claims = batches.flat().filter((item) => item.id === row.id)
    expect(claims).toHaveLength(1)
    expect(await deliverNotification(claims[0], sent)).toBe("ACCEPTED")
    expect(
      await db.notificationOutbox.findUnique({ where: { id: row.id } })
    ).toMatchObject({
      status: "ACCEPTED",
      providerMessageId: "smtp-id",
      deliveredAt: null,
    })
  })
  it("holds expired leases and ambiguous outcomes rather than resending", async () => {
    const u = await user()
    const row = await queued(u.id)
    await db.notificationOutbox.update({
      where: { id: row.id },
      data: {
        status: "PROCESSING",
        claimedAt: new Date(0),
        claimToken: "dead",
      },
    })
    await claimNotifications(1)
    expect(
      (await db.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } }))
        .status
    ).toBe("AMBIGUOUS")
    const fresh = await queued(u.id)
    const processing = await db.notificationOutbox.update({
      where: { id: fresh.id },
      data: { status: "PROCESSING", claimToken: "ambiguous", attempts: 1 },
    })
    expect(
      await deliverNotification(processing, {
        ...sent,
        email: async () => ({ status: "AMBIGUOUS", error: "TEST_TIMEOUT" }),
      })
    ).toBe("AMBIGUOUS")
  })
  it("backs off rejection retries and alerts admins when attempts are exhausted", async () => {
    const u = await user()
    const a = await user("ADMIN")
    const row = await queued(u.id)
    let processing = await db.notificationOutbox.update({
      where: { id: row.id },
      data: { status: "PROCESSING", claimToken: "retry", attempts: 1 },
    })
    const reject = {
      ...sent,
      email: async () => ({
        status: "REJECTED" as const,
        error: "EMAIL_REJECTED_450",
        retryable: true,
      }),
    }
    expect(await deliverNotification(processing, reject)).toBe("PENDING")
    expect(
      (
        await db.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } })
      ).nextAttemptAt.getTime()
    ).toBeGreaterThan(Date.now())
    processing = await db.notificationOutbox.update({
      where: { id: row.id },
      data: { status: "PROCESSING", claimToken: "exhausted", attempts: 5 },
    })
    expect(await deliverNotification(processing, reject)).toBe("FAILED")
    expect(
      await db.notificationOutbox.count({
        where: { recipientId: a.id, eventKey: `delivery-failed:${row.id}` },
      })
    ).toBe(1)
  })
  it("cancels creator/admin messages when recipient authorization changes", async () => {
    const u = await user("RIGHTS_HOLDER"),
      a = await user("ADMIN")
    const holder = await db.rightsHolder.create({
      data: { name: `Notification Holder ${randomUUID()}` },
    })
    holders.push(holder.id)
    await db.rightsHolderMembership.create({
      data: { userId: u.id, rightsHolderId: holder.id },
    })
    await db.$transaction((tx) =>
      enqueueRightsHolderNotification(tx, holder.id, `publication:${u.id}`, {
        type: "PUBLICATION_CHANGED",
        title: "Fixture",
        status: "PUBLISHED",
      })
    )
    await db.rightsHolderMembership.deleteMany({ where: { userId: u.id } })
    const row = await db.notificationOutbox.findFirstOrThrow({
      where: { recipientId: u.id },
    })
    const processing = await db.notificationOutbox.update({
      where: { id: row.id },
      data: { status: "PROCESSING", claimToken: "scope" },
    })
    expect(await deliverNotification(processing, sent)).toBe("CANCELLED")
    await db.$transaction((tx) =>
      enqueueAdminAlert(tx, `alert:${u.id}`, "Action required")
    )
    await db.user.update({ where: { id: a.id }, data: { role: "VIEWER" } })
    const alert = await db.notificationOutbox.findFirstOrThrow({
      where: { recipientId: a.id },
    })
    expect(
      await deliverNotification(
        await db.notificationOutbox.update({
          where: { id: alert.id },
          data: { status: "PROCESSING", claimToken: "admin" },
        }),
        sent
      )
    ).toBe("CANCELLED")
  })
  it("restricts queue inspection and reconciliation; uncertain retries require evidence", async () => {
    const u = await user(),
      a = await user("ADMIN")
    const row = await queued(u.id)
    await expect(notificationQueue(u.id, {})).rejects.toMatchObject({
      code: "ADMIN_REQUIRED",
    })
    await db.notificationOutbox.update({
      where: { id: row.id },
      data: { status: "AMBIGUOUS" },
    })
    await expect(
      resolveNotification(a.id, row.id, {
        action: "retry",
        confirmedNotAccepted: false,
        note: "Checked with provider",
      })
    ).rejects.toThrow()
    await resolveNotification(a.id, row.id, {
      action: "accepted",
      providerMessageId: "confirmed-id",
      note: "Provider dashboard confirms acceptance",
    })
    expect(
      (await db.notificationOutbox.findUniqueOrThrow({ where: { id: row.id } }))
        .status
    ).toBe("ACCEPTED")
  })
})

describe("Ghana phone ownership", () => {
  it("normalizes Ghana numbers and rejects unsupported inputs", () => {
    expect(normalizeGhanaPhone("024 123-4567")).toBe("+233241234567")
    expect(normalizeGhanaPhone("+233 24 123 4567")).toBe("+233241234567")
    expect(() => normalizeGhanaPhone("+15551234567")).toThrow()
  })
  it("expires codes, preserves resend limits across number changes, and clears consent", async () => {
    process.env.BETTER_AUTH_SECRET = "test-phone-hmac-secret"
    const u = await user()
    await savePhoneSettings(u.id, { phone: "0241234567" })
    let code = ""
    const send = vi.fn(async (_phone: string, text: string) => {
      code = text.match(/\b\d{6}\b/)![0]
      return { status: "ACCEPTED" as const, messageId: "otp-id" }
    })
    const now = new Date()
    await requestPhoneCode(u.id, send, now)
    expect(
      (
        await db.phoneVerification.findUniqueOrThrow({
          where: { userId: u.id },
        })
      ).codeHash
    ).not.toContain(code)
    await expect(requestPhoneCode(u.id, send, now)).rejects.toMatchObject({
      code: "CODE_RATE_LIMIT",
    })
    await expect(
      verifyPhoneCode(u.id, { code }, new Date(now.getTime() + 300_001))
    ).rejects.toMatchObject({ code: "INVALID_CODE" })
    await verifyPhoneCode(u.id, { code }, new Date(now.getTime() + 1000))
    await savePhoneSettings(u.id, {
      phone: "0241234567",
      transactionalSmsConsent: true,
    })
    await savePhoneSettings(u.id, {
      phone: "0201234567",
      transactionalSmsConsent: true,
    })
    expect(await db.user.findUnique({ where: { id: u.id } })).toMatchObject({
      phoneVerifiedAt: null,
      transactionalSmsConsent: false,
    })
    await expect(requestPhoneCode(u.id, send, now)).rejects.toMatchObject({
      code: "CODE_RATE_LIMIT",
    })
  })
  it("limits attempts and five code sends per hour; codes are scoped to their owner", async () => {
    process.env.BETTER_AUTH_SECRET = "test-phone-hmac-secret"
    const u = await user(),
      other = await user()
    await savePhoneSettings(u.id, { phone: "0241234567" })
    let code = ""
    const now = new Date()
    const send = async (_phone: string, text: string) => {
      code = text.match(/\b\d{6}\b/)![0]
      return { status: "ACCEPTED" as const, messageId: "otp-id" }
    }
    await requestPhoneCode(u.id, send, now)
    await expect(
      verifyPhoneCode(other.id, { code }, now)
    ).rejects.toMatchObject({ code: "INVALID_CODE" })
    const wrong = code === "000000" ? "000001" : "000000"
    for (let attempt = 0; attempt < 5; attempt++)
      await expect(
        verifyPhoneCode(u.id, { code: wrong }, now)
      ).rejects.toMatchObject({ code: "INVALID_CODE" })
    await expect(verifyPhoneCode(u.id, { code }, now)).rejects.toMatchObject({
      code: "INVALID_CODE",
    })
    for (let sendIndex = 1; sendIndex < 5; sendIndex++)
      await requestPhoneCode(
        u.id,
        send,
        new Date(now.getTime() + sendIndex * 60_001)
      )
    await expect(
      requestPhoneCode(u.id, send, new Date(now.getTime() + 6 * 60_001))
    ).rejects.toMatchObject({ code: "CODE_RATE_LIMIT" })
  })
})
describe("UelloSend contract", () => {
  it("records a delivery only after a matching carrier receipt", async () => {
    const u = await user()
    const row = await queued(u.id)
    await db.notificationOutbox.update({
      where: { id: row.id },
      data: {
        channel: "SMS",
        status: "ACCEPTED",
        providerMessageId: "carrier-fixture",
        nextAttemptAt: new Date(0),
      },
    })
    await reconcileSmsReceipts(8, async (id) => {
      expect(id).toBe("carrier-fixture")
      return "DELIVERED"
    })
    const saved = await db.notificationOutbox.findUniqueOrThrow({
      where: { id: row.id },
    })
    expect(saved.status).toBe("DELIVERED")
    expect(saved.deliveredAt).toBeInstanceOf(Date)
    const oldKey = process.env.UELLOSEND_API_KEY
    process.env.UELLOSEND_API_KEY = "fixture-key"
    try {
      const fetch = vi.spyOn(globalThis, "fetch")
      fetch.mockResolvedValueOnce(
        Response.json({
          status: "Success",
          code: "200",
          desc: [
            { message_uuid: "another-message", delivery_status: "DELIVERED" },
          ],
        })
      )
      expect(await smsDeliveryReceipt("carrier-fixture")).toBe("ACCEPTED")
      fetch.mockResolvedValueOnce(
        Response.json({
          status: "Success",
          code: "200",
          desc: [
            {
              message_uuid: "carrier-fixture",
              delivery_status: "NOT_DELIVERED",
            },
          ],
        })
      )
      expect(await smsDeliveryReceipt("carrier-fixture")).toBe("FAILED")
    } finally {
      process.env.UELLOSEND_API_KEY = oldKey
    }
  })
  it("bounds SMTP calls and closes the active socket on deadline", async () => {
    const keys = [
      "SMTP_HOST",
      "SMTP_PORT",
      "SMTP_USER",
      "SMTP_PASS",
      "SMTP_FROM",
      "SMTP_SECURE",
      "NOTIFICATION_TIMEOUT_MS",
    ] as const
    const previous = Object.fromEntries(
      keys.map((key) => [key, process.env[key]])
    )
    const sockets = new Set<Socket>()
    const server = createServer((socket) => {
      sockets.add(socket)
      socket.on("close", () => sockets.delete(socket))
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const address = server.address()
    if (!address || typeof address === "string")
      throw Error("Test SMTP unavailable")
    Object.assign(process.env, {
      SMTP_HOST: "127.0.0.1",
      SMTP_PORT: String(address.port),
      SMTP_USER: "fixture",
      SMTP_PASS: "fixture",
      SMTP_FROM: "GhanaVerse <fixture@example.test>",
      SMTP_SECURE: "false",
      NOTIFICATION_TIMEOUT_MS: "1000",
    })
    try {
      const started = performance.now()
      expect(
        (await sendEmail("receiver@example.test", "Fixture", "Fixture")).status
      ).toBe("AMBIGUOUS")
      expect(performance.now() - started).toBeLessThan(2500)
    } finally {
      for (const socket of sockets) socket.destroy()
      await new Promise<void>((resolve) => server.close(() => resolve()))
      for (const key of keys)
        if (previous[key] === undefined) delete process.env[key]
        else process.env[key] = previous[key]
    }
  })
  it("checks HTTP and body acceptance, rejects body errors, holds malformed/timeouts", async () => {
    const oldKey = process.env.UELLOSEND_API_KEY,
      oldSender = process.env.UELLOSEND_SENDER_ID
    process.env.UELLOSEND_API_KEY = "fixture-key"
    process.env.UELLOSEND_SENDER_ID = "GhanaVerse"
    const fetch = vi.spyOn(globalThis, "fetch")
    try {
      fetch.mockResolvedValueOnce(
        Response.json({
          status: "Success",
          code: "200",
          desc: [
            {
              status: "success",
              recipient: "233241234567",
              message_id: "sms-fixture",
            },
          ],
        })
      )
      expect(await sendSms("+233241234567", "Fixture")).toEqual({
        status: "ACCEPTED",
        messageId: "sms-fixture",
      })
      fetch.mockResolvedValueOnce(
        Response.json({
          status: "Error",
          code: "401",
          desc: "Insufficient credit",
        })
      )
      expect((await sendSms("+233241234567", "Fixture")).status).toBe(
        "REJECTED"
      )
      fetch.mockResolvedValueOnce(Response.json({ status: "Success" }))
      expect((await sendSms("+233241234567", "Fixture")).status).toBe(
        "AMBIGUOUS"
      )
      fetch.mockRejectedValueOnce(new Error("connection lost"))
      expect((await sendSms("+233241234567", "Fixture")).status).toBe(
        "AMBIGUOUS"
      )
    } finally {
      process.env.UELLOSEND_API_KEY = oldKey
      process.env.UELLOSEND_SENDER_ID = oldSender
    }
  })
})
