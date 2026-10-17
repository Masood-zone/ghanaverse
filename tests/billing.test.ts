import {
  beforeAll,
  afterAll,
  afterEach,
  describe,
  it,
  expect,
  vi,
} from "vitest"
import { createHash, createHmac, randomUUID } from "node:crypto"
import { getPrisma } from "@/lib/prisma"
import {
  initializeCheckout,
  reconcilePayment,
  ensurePlan,
  billingSummary,
} from "@/services/billing/payments"
import {
  authorizePremium,
  premiumAccess,
  assertPremiumPublication,
} from "@/services/billing/access"
import {
  approveRecipient,
  approvePayout,
  sendPayout,
  reconcilePayout,
  createLicense,
  licenseStatus,
  earnings,
  createRecipient,
} from "@/services/billing/licensing"
import { processPaystackWebhook } from "@/services/billing/webhooks"
import { verifyPaystackSignature } from "@/lib/paystack"
import { checkoutSchema } from "@/lib/validation/billing"
import { playbackSource } from "@/services/video/playback"
import { r2 } from "@/lib/r2/provider"
const db = getPrisma(),
  suffix = randomUUID(),
  viewer = `billing-v-${suffix}`,
  admin = `billing-a-${suffix}`,
  owner = `billing-o-${suffix}`,
  outsider = `billing-x-${suffix}`
const originals = {
  key: process.env.PAYSTACK_SECRET_KEY,
  live: process.env.BILLING_LIVE_ENABLED,
  payouts: process.env.PAYOUTS_LIVE_ENABLED,
}
const testKey = "sk_test_billing_test_fixture"
const references: string[] = [],
  licenseIds: string[] = [],
  recipientIds: string[] = [],
  webhookIds: string[] = []
let holder: string,
  contentId: string,
  profileId: string,
  assetId: string,
  uploadId: string,
  objectId: string
let planBefore: Awaited<ReturnType<typeof ensurePlan>>
const provider = vi.spyOn(globalThis, "fetch")
function response(data: unknown, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify({ status: status === 200, data }), { status })
  )
}
function verified(reference: string, extra: Record<string, unknown> = {}) {
  return {
    id: 1234,
    reference,
    status: "success",
    amount: 4500,
    currency: "GHS",
    domain: "test",
    customer: { email: `${viewer}@example.test` },
    channel: "card",
    fees: 88,
    ...extra,
  }
}
async function order() {
  const reference = `gv-test-${randomUUID()}`
  references.push(reference)
  return db.billingPayment.create({
    data: {
      userId: viewer,
      planId: "premium",
      mode: "test",
      reference,
      idempotencyKey: randomUUID(),
      amount: 4500,
      email: `${viewer}@example.test`,
      channel: "card",
    },
  })
}
async function agreement() {
  const license = await createLicense(admin, {
    contentId,
    rightsHolderId: holder,
    amount: 60000,
    startsAt: new Date(Date.now() - 86400000).toISOString(),
    endsAt: new Date(Date.now() + 86400000 * 90).toISOString(),
    dueAt: new Date().toISOString(),
    contractReference: `contract-${randomUUID()}`,
    commercialUse: true,
  })
  licenseIds.push(license.id)
  await licenseStatus(admin, license.id, { status: "APPROVED" })
  return license.id
}
async function recipient() {
  const row = await db.payoutRecipient.create({
    data: {
      rightsHolderId: holder,
      mode: "test",
      type: "mobile_money",
      name: "Rights Holder",
      bankCode: "MTN",
      maskedAccount: "•••• 1234",
      providerCode: `RCP_${randomUUID()}`,
    },
  })
  recipientIds.push(row.id)
  await approveRecipient(admin, row.id)
  return row.id
}
async function webhook(event: string, data: Record<string, unknown>) {
  const raw = JSON.stringify({ event, data })
  const signature = createHmac("sha512", testKey).update(raw).digest("hex")
  webhookIds.push(
    createHash("sha256")
      .update(`test:${event}:${String(data.id)}`)
      .digest("hex")
  )
  return processPaystackWebhook(raw, signature)
}
beforeAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = testKey
  planBefore = await ensurePlan()
  await db.billingPlan.update({
    where: { id: "premium" },
    data: { amount: 4500, enabled: true, commercialConfirmed: false },
  })
  await db.user.createMany({
    data: [
      { id: viewer, name: "Billing Viewer", email: `${viewer}@example.test` },
      {
        id: admin,
        name: "Billing Admin",
        email: `${admin}@example.test`,
        role: "ADMIN",
      },
      {
        id: owner,
        name: "Billing Owner",
        email: `${owner}@example.test`,
        role: "RIGHTS_HOLDER",
      },
      {
        id: outsider,
        name: "Other Owner",
        email: `${outsider}@example.test`,
        role: "RIGHTS_HOLDER",
      },
    ],
  })
  holder = (
    await db.rightsHolder.create({ data: { name: `Billing Holder ${suffix}` } })
  ).id
  await db.rightsHolderMembership.create({
    data: { userId: owner, rightsHolderId: holder },
  })
  profileId = (
    await db.viewerProfile.create({ data: { userId: viewer, name: "Viewer" } })
  ).id
  contentId = (
    await db.content.create({
      data: {
        title: "Billing Test",
        slug: `billing-${suffix}`,
        shortDescription: "Test",
        description: "Test",
        contentType: "MOVIE",
        isPremium: true,
        rightsHolderId: holder,
        publicationStatus: "PUBLISHED",
        mediaRights: "ORIGINAL",
      },
    })
  ).id
  uploadId = `billing-upload-${suffix}`
  objectId = `billing-object-${suffix}`
  await db.videoUploadSession.create({
    data: {
      id: uploadId,
      idempotencyKey: randomUUID(),
      actorId: admin,
      contentId,
      destination: "movie",
      filename: "sample.mp4",
      fileSize: 100,
      lastModified: 1,
      fingerprint: "a".repeat(64),
      licenseType: "ORIGINAL",
      mediaMetadata: {},
      endpoint: "https://test.r2.invalid",
      bucket: "test",
      objectKey: `test-${suffix}`,
      status: "COMPLETED",
      expiresAt: new Date(),
    },
  })
  await db.storedVideoObject.create({
    data: {
      id: objectId,
      sessionId: uploadId,
      endpoint: "https://test.r2.invalid",
      bucket: "test",
      objectKey: `stored-${suffix}`,
      bytes: 100,
      etag: "test",
      metadata: {},
    },
  })
  assetId = (
    await db.videoAsset.create({
      data: {
        contentId,
        sourceType: "MANAGED",
        storedObjectId: objectId,
        isPlayable: true,
        licenseType: "ORIGINAL",
      },
    })
  ).id
})
afterEach(async () => {
  provider.mockReset()
  process.env.PAYSTACK_SECRET_KEY = testKey
  process.env.BILLING_LIVE_ENABLED = originals.live
  process.env.PAYOUTS_LIVE_ENABLED = originals.payouts
  await db.user.update({ where: { id: viewer }, data: { isSuspended: false } })
})
afterAll(async () => {
  provider.mockRestore()
  await db.payoutAttempt.deleteMany({
    where: { licenseId: { in: licenseIds } },
  })
  await db.payoutRecipient.deleteMany({ where: { id: { in: recipientIds } } })
  await db.contentLicense.deleteMany({ where: { id: { in: licenseIds } } })
  await db.premiumGrant.deleteMany({ where: { userId: viewer } })
  await db.paymentWebhook.deleteMany({ where: { id: { in: webhookIds } } })
  await db.billingPayment.deleteMany({ where: { userId: viewer } })
  await db.videoAsset.deleteMany({ where: { contentId } })
  await db.storedVideoObject.delete({ where: { id: objectId } })
  await db.videoUploadSession.delete({ where: { id: uploadId } })
  await db.content.delete({ where: { id: contentId } })
  await db.user.deleteMany({
    where: { id: { in: [viewer, admin, owner, outsider] } },
  })
  await db.rightsHolder.delete({ where: { id: holder } })
  await db.auditLog.deleteMany({ where: { actorId: { in: [admin, owner] } } })
  await db.billingPlan.update({
    where: { id: "premium" },
    data: {
      amount: planBefore.amount,
      enabled: planBefore.enabled,
      commercialConfirmed: planBefore.commercialConfirmed,
    },
  })
  process.env.PAYSTACK_SECRET_KEY = originals.key
})
describe("verified premium billing", () => {
  it("requires a Ghanaian phone and network only for Mobile Money", () => {
    const base = {
      channel: "mobile_money",
      idempotencyKey: randomUUID(),
      mobileMoneyNetwork: "mtn",
    }
    for (const payerPhone of [
      "024 123 4567",
      "+233 24 123 4567",
      "(050) 123-4567",
    ])
      expect(checkoutSchema.safeParse({ ...base, payerPhone }).success).toBe(
        true
      )
    for (const payerPhone of [
      undefined,
      "",
      "123",
      "+234241234567",
      "0301234567",
      "02412345678",
    ])
      expect(checkoutSchema.safeParse({ ...base, payerPhone }).success).toBe(
        false
      )
    expect(
      checkoutSchema.safeParse({
        ...base,
        payerPhone: "0241234567",
        mobileMoneyNetwork: "unknown",
      }).success
    ).toBe(false)
    expect(
      checkoutSchema.safeParse({
        channel: "card",
        idempotencyKey: randomUUID(),
      }).success
    ).toBe(true)
    expect(
      checkoutSchema.safeParse({
        channel: "card",
        idempotencyKey: randomUUID(),
        payerPhone: "0241234567",
      }).success
    ).toBe(false)
  })
  it("initializes hosted checkout once and retains the order's original price", async () => {
    provider.mockImplementation(async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        reference: string
        amount: number
        channels: string[]
      }
      expect(body.amount).toBe(4500)
      expect(body.channels).toEqual(["mobile_money"])
      return new Response(
        JSON.stringify({
          status: true,
          data: {
            reference: body.reference,
            authorization_url: "https://checkout.paystack.com/test-session",
          },
        })
      )
    })
    const idempotencyKey = randomUUID()
    const first = await initializeCheckout(viewer, {
      channel: "mobile_money",
      idempotencyKey,
      mobileMoneyNetwork: "mtn",
      payerPhone: "024 123 4567",
    })
    await db.billingPlan.update({
      where: { id: "premium" },
      data: { amount: 5000 },
    })
    const second = await initializeCheckout(viewer, {
      channel: "mobile_money",
      idempotencyKey,
      mobileMoneyNetwork: "mtn",
      payerPhone: "+233241234567",
    })
    expect(second).toEqual(first)
    expect(provider).toHaveBeenCalledTimes(1)
    expect(
      (
        await db.billingPayment.findUniqueOrThrow({
          where: { reference: first.reference },
        })
      ).amount
    ).toBe(4500)
    await db.billingPlan.update({
      where: { id: "premium" },
      data: { amount: 4500 },
    })
    await db.billingPayment.update({
      where: { reference: first.reference },
      data: { status: "FAILED" },
    })
  })
  it("filters each network, stores only a masked number, and reconciles cancellation before another purchase", async () => {
    for (const [network, code] of [
      ["mtn", "mtn"],
      ["telecel", "vod"],
      ["at", "atl"],
    ]) {
      provider.mockImplementation(async (_url, init) => {
        const body = JSON.parse(String(init?.body))
        const metadata = JSON.parse(body.metadata)
        expect(body.channels).toEqual(["mobile_money"])
        expect(
          metadata.custom_filters.supported_mobile_money_providers
        ).toEqual([code])
        expect(new URL(metadata.cancel_action).pathname).toBe("/plans")
        expect(new URL(metadata.cancel_action).searchParams.get("step")).toBe(
          "payment"
        )
        expect(
          new URL(metadata.cancel_action).searchParams.get("reference")
        ).toBe(body.reference)
        expect(new URL(body.callback_url).pathname).toBe("/plans/result")
        expect(JSON.stringify(body)).not.toContain("241234567")
        return response({
          reference: body.reference,
          authorization_url: "https://checkout.paystack.com/test-network",
        })
      })
      const input = {
        channel: "mobile_money",
        idempotencyKey: randomUUID(),
        mobileMoneyNetwork: network,
        payerPhone: "+233241234567",
      }
      const first = await initializeCheckout(viewer, input)
      const stored = await db.billingPayment.findUniqueOrThrow({
        where: { reference: first.reference },
      })
      expect(stored.mobileMoneyNetwork).toBe(network)
      expect(stored.maskedPayerPhone).toBe("•••• 4567")
      expect(JSON.stringify(stored)).not.toContain("241234567")
      provider.mockImplementation(() =>
        response(verified(first.reference, { status: "pending" }))
      )
      await expect(
        initializeCheckout(viewer, {
          channel: "card",
          idempotencyKey: randomUUID(),
        })
      ).rejects.toMatchObject({ code: "PAYMENT_PENDING" })
      expect(
        (
          await db.billingPayment.findUniqueOrThrow({
            where: { id: stored.id },
          })
        ).status
      ).toBe("PENDING")
      expect(await initializeCheckout(viewer, input)).toEqual(first)
      provider.mockImplementation(() =>
        response(verified(first.reference, { status: "abandoned" }))
      )
      await reconcilePayment(first.reference, viewer)
    }
  })
  it("rejects foreign owners and mismatched amount, currency, email and environment", async () => {
    const p = await order()
    await expect(reconcilePayment(p.reference, outsider)).rejects.toMatchObject(
      { code: "PAYMENT_NOT_FOUND" }
    )
    for (const extra of [
      { amount: 1 },
      { currency: "NGN" },
      { domain: "live" },
      { customer: { email: "other@example.test" } },
    ]) {
      provider.mockImplementation(() => response(verified(p.reference, extra)))
      await expect(reconcilePayment(p.reference, viewer)).rejects.toMatchObject(
        { code: "PAYMENT_MISMATCH" }
      )
    }
    expect(await db.premiumGrant.count({ where: { paymentId: p.id } })).toBe(0)
  })
  it("grants exactly 30 days once under concurrent callback and webhook verification; early renewal stacks", async () => {
    const p = await order()
    provider.mockImplementation(() => response(verified(p.reference)))
    const [first] = await Promise.all([
      reconcilePayment(p.reference, viewer),
      reconcilePayment(p.reference),
      webhook("charge.success", {
        id: 1234,
        domain: "test",
        reference: p.reference,
      }),
    ])
    expect(first).toMatchObject({
      active: true,
      renewal: false,
      amount: 4500,
      days: 30,
    })
    const grant = await db.premiumGrant.findUniqueOrThrow({
      where: { paymentId: p.id },
    })
    expect(grant.endsAt.getTime() - grant.startsAt.getTime()).toBe(
      30 * 86400000
    )
    expect(await db.premiumGrant.count({ where: { paymentId: p.id } })).toBe(1)
    const p2 = await order()
    provider.mockImplementation(() => response(verified(p2.reference)))
    const renewal = await reconcilePayment(p2.reference, viewer)
    const grant2 = await db.premiumGrant.findUniqueOrThrow({
      where: { paymentId: p2.id },
    })
    expect(grant2.startsAt).toEqual(grant.endsAt)
    expect((await premiumAccess(viewer)).active).toBe(true)
    expect(renewal).toMatchObject({
      amount: 4500,
      days: 30,
      active: true,
      renewal: true,
      access: { active: true, expiresAt: grant2.endsAt.toISOString() },
    })
    await db.premiumGrant.update({
      where: { id: grant.id },
      data: {
        startsAt: new Date(Date.now() - 32 * 86400000),
        endsAt: new Date(Date.now() - 2 * 86400000),
      },
    })
    provider.mockImplementation(() => response(verified(p.reference)))
    const expired = await reconcilePayment(p.reference, viewer)
    expect(expired.status).toBe("SUCCESS")
    expect(expired.active).toBe(false)
    await db.premiumGrant.update({
      where: { id: grant.id },
      data: { startsAt: grant.startsAt, endsAt: grant.endsAt },
    })
  })
  it("does not activate pending, failed, or abandoned transactions", async () => {
    for (const status of ["pending", "failed", "abandoned"]) {
      const p = await order()
      provider.mockImplementation(() =>
        response(verified(p.reference, { status }))
      )
      await reconcilePayment(p.reference, viewer)
      expect(await db.premiumGrant.count({ where: { paymentId: p.id } })).toBe(
        0
      )
      await expect(
        webhook("charge.success", {
          id: `not-final-${status}`,
          domain: "test",
          reference: p.reference,
        })
      ).rejects.toMatchObject({ code: "PAYMENT_NOT_READY" })
    }
  })
  it("validates signatures and acknowledges unrelated integration transactions", async () => {
    expect(verifyPaystackSignature("{}", "0".repeat(128))).toBe(false)
    await expect(processPaystackWebhook("{}", "bad")).rejects.toMatchObject({
      code: "INVALID_SIGNATURE",
    })
    await webhook("charge.success", {
      id: "unrelated",
      domain: "test",
      reference: "not-ghanaverse",
    })
    expect(provider).not.toHaveBeenCalled()
  })
  it("deduplicates partial refunds, revokes only a fully refunded grant, and never regrants it", async () => {
    const p = await order()
    provider.mockImplementation(() => response(verified(p.reference)))
    await reconcilePayment(p.reference, viewer)
    let processed = false
    provider.mockImplementation((url) =>
      String(url).includes("/transaction/1641")
        ? response({ reference: p.reference, domain: "test", currency: "GHS" })
        : response({
            id: String(url).split("/").at(-1),
            amount: String(url).endsWith("refund-one") ? 1000 : 3500,
            status: processed ? "processed" : "processing",
            currency: "GHS",
            domain: "test",
            transaction: 1641,
          })
    )
    await expect(
      webhook("refund.processed", { id: "refund-one", domain: "test" })
    ).rejects.toMatchObject({ code: "ADJUSTMENT_NOT_READY" })
    processed = true
    await webhook("refund.processed", { id: "refund-one", domain: "test" })
    await webhook("refund.processed", { id: "refund-one", domain: "test" })
    expect(
      (await db.billingPayment.findUniqueOrThrow({ where: { id: p.id } }))
        .refundAmount
    ).toBe(1000)
    expect(
      (await db.premiumGrant.findUniqueOrThrow({ where: { paymentId: p.id } }))
        .revokedAt
    ).toBeNull()
    await webhook("refund.processed", { id: "refund-two", domain: "test" })
    expect(
      (await db.premiumGrant.findUniqueOrThrow({ where: { paymentId: p.id } }))
        .revokedAt
    ).not.toBeNull()
    provider.mockImplementation(() => response(verified(p.reference)))
    await reconcilePayment(p.reference)
    expect(
      (await db.billingPayment.findUniqueOrThrow({ where: { id: p.id } }))
        .status
    ).toBe("REFUNDED")
    expect(
      await db.premiumGrant.count({
        where: { userId: viewer, revokedAt: null },
      })
    ).toBeGreaterThan(0)
  })
  it("revokes confirmed chargebacks after provider verification", async () => {
    const p = await order()
    provider.mockImplementation(() => response(verified(p.reference)))
    await reconcilePayment(p.reference)
    provider.mockImplementation(() =>
      response({
        id: "dispute-one",
        status: "resolved",
        resolution: "merchant-accepted",
        currency: null,
        domain: "test",
        transaction: {
          reference: p.reference,
          domain: "test",
          currency: "GHS",
        },
      })
    )
    await webhook("charge.dispute.resolve", {
      id: "dispute-one",
      domain: "test",
    })
    expect(
      (await db.billingPayment.findUniqueOrThrow({ where: { id: p.id } }))
        .status
    ).toBe("CHARGEBACK")
  })
  it("enforces private video, licence windows, suspension, expiry and test/live separation", async () => {
    const content = await db.content.findUniqueOrThrow({
      where: { id: contentId },
    })
    await expect(
      authorizePremium(viewer, content, "REMOTE_URL")
    ).rejects.toMatchObject({ code: "PRIVATE_VIDEO_REQUIRED" })
    await expect(
      authorizePremium(viewer, content, "MANAGED")
    ).rejects.toMatchObject({ code: "LICENSE_UNAVAILABLE" })
    const id = await agreement()
    expect(await authorizePremium(viewer, content, "MANAGED")).toBeInstanceOf(
      Date
    )
    await assertPremiumPublication(db, content)
    const signed = vi
      .spyOn(r2, "playback")
      .mockImplementation(async (_target, seconds) => ({
        url: "https://r2.invalid/private",
        expiresAt: new Date(Date.now() + seconds! * 1000).toISOString(),
      }))
    await db.viewerProfile.update({
      where: { id: profileId },
      data: { isKids: true },
    })
    await expect(
      playbackSource(viewer, assetId, { profileId })
    ).rejects.toMatchObject({ code: "PROFILE_CONTENT_RESTRICTED" })
    await db.viewerProfile.update({
      where: { id: profileId },
      data: { isKids: false },
    })
    const endsAt = new Date(Date.now() + 120000)
    await db.contentLicense.update({ where: { id }, data: { endsAt } })
    const source = await playbackSource(viewer, assetId, { profileId })
    expect(source).toMatchObject({ accessExpiresAt: endsAt.toISOString() })
    expect(signed.mock.calls[0][1]).toBeLessThanOrEqual(300)
    expect(signed.mock.calls[0][1]).toBeLessThanOrEqual(120)
    signed.mockRestore()
    await db.contentLicense.update({
      where: { id },
      data: { endsAt: new Date(Date.now() - 1000) },
    })
    await expect(
      playbackSource(viewer, assetId, { profileId })
    ).rejects.toMatchObject({ code: "LICENSE_UNAVAILABLE" })
    await db.user.update({ where: { id: viewer }, data: { isSuspended: true } })
    expect((await premiumAccess(viewer)).active).toBe(false)
    await db.user.update({
      where: { id: viewer },
      data: { isSuspended: false },
    })
    expect(
      (await premiumAccess(viewer, new Date(Date.now() + 200 * 86400000)))
        .active
    ).toBe(false)
    process.env.PAYSTACK_SECRET_KEY = "sk_live_billing_test_fixture"
    expect((await premiumAccess(viewer)).active).toBe(false)
    expect((await billingSummary(viewer)).canCheckout).toBe(false)
    process.env.PAYSTACK_SECRET_KEY = testKey
    await licenseStatus(admin, id, { status: "REVOKED" })
    await expect(
      authorizePremium(viewer, content, "MANAGED")
    ).rejects.toMatchObject({ code: "LICENSE_UNAVAILABLE" })
  })
})
describe("fixed licensing payout safety", () => {
  it("restricts creator reports to memberships and rejects creator administration", async () => {
    expect((await earnings(outsider)).licenses).toEqual([])
    const data = await earnings(owner)
    expect(data.licenses.every((l) => l.rightsHolderId === holder)).toBe(true)
    await expect(approveRecipient(owner, "missing")).rejects.toMatchObject({
      code: "ADMIN_REQUIRED",
    })
    await expect(
      createRecipient(outsider, {
        rightsHolderId: holder,
        type: "mobile_money",
        name: "Someone",
        bankCode: "MTN",
        accountNumber: "0551234567",
      })
    ).rejects.toMatchObject({ code: "HOLDER_NOT_FOUND" })
  })
  it("only stores masked recipient details and requires approval", async () => {
    provider.mockImplementation((url) =>
      String(url).includes("/bank?")
        ? response([{ name: "MTN", code: "MTN", active: true }])
        : response({ recipient_code: `RCP_${suffix}`, domain: "test" })
    )
    const r = await createRecipient(owner, {
      rightsHolderId: holder,
      type: "mobile_money",
      name: "Verified by administrator",
      bankCode: "MTN",
      accountNumber: "0551234567",
    })
    recipientIds.push(r.id)
    const saved = await db.payoutRecipient.findUniqueOrThrow({
      where: { id: r.id },
    })
    expect(saved.maskedAccount).toBe("•••• 4567")
    expect(JSON.stringify(saved)).not.toContain("0551234567")
    const l = await agreement()
    await expect(
      approvePayout(admin, { licenseId: l, recipientId: r.id })
    ).rejects.toMatchObject({ code: "RECIPIENT_NOT_APPROVED" })
  })
  it("prevents concurrent payout approvals and invalidates unsent approvals after recipient replacement", async () => {
    const l = await agreement(),
      r = await recipient()
    const results = await Promise.allSettled([
      approvePayout(admin, { licenseId: l, recipientId: r }),
      approvePayout(admin, { licenseId: l, recipientId: r }),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    const original = await db.payoutAttempt.findFirstOrThrow({
      where: { licenseId: l },
    })
    await recipient()
    expect(
      (await db.payoutAttempt.findUniqueOrThrow({ where: { id: original.id } }))
        .status
    ).toBe("CANCELLED")
    await expect(sendPayout(admin, original.id)).rejects.toMatchObject({
      code: "RECONCILE_REQUIRED",
    })
  })
  it("handles OTP, concurrent sends, terminal success, stale responses, and reversals", async () => {
    const l = await agreement(),
      r = await recipient(),
      p = await approvePayout(admin, { licenseId: l, recipientId: r })
    const attempt = await db.payoutAttempt.findUniqueOrThrow({
      where: { id: p.id },
    })
    let status = "otp"
    const transfer = () => ({
      reference: attempt.reference,
      transfer_code: "TRF_test",
      status,
      amount: 60000,
      currency: "GHS",
      domain: "test",
      recipient: { recipient_code: attempt.recipientCode },
    })
    provider.mockImplementation(() => response(transfer()))
    const results = await Promise.allSettled([
      sendPayout(admin, p.id),
      sendPayout(admin, p.id),
    ])
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1)
    expect(
      (await db.payoutAttempt.findUniqueOrThrow({ where: { id: p.id } })).status
    ).toBe("OTP_REQUIRED")
    status = "success"
    await sendPayout(admin, p.id, "123456")
    await expect(
      approvePayout(admin, { licenseId: l, recipientId: r })
    ).rejects.toMatchObject({ code: "PAYOUT_EXISTS" })
    status = "pending"
    expect((await reconcilePayout(p.id)).status).toBe("SUCCESS")
    status = "reversed"
    expect((await reconcilePayout(p.id)).status).toBe("REVERSED")
    status = "success"
    expect((await reconcilePayout(p.id)).status).toBe("REVERSED")
  })
  it("retains a provider rejection for reconciliation without authorizing a second payment", async () => {
    const l = await agreement(),
      r = await recipient(),
      p = await approvePayout(admin, { licenseId: l, recipientId: r })
    // Includes insufficient transfer balance: an HTTP rejection is not proof of settlement.
    provider.mockImplementation(() => response(null, 400))
    await expect(sendPayout(admin, p.id)).rejects.toMatchObject({
      code: "PROVIDER_REJECTED",
    })
    expect(
      (await db.payoutAttempt.findUniqueOrThrow({ where: { id: p.id } })).status
    ).toBe("UNKNOWN")
    await expect(
      approvePayout(admin, { licenseId: l, recipientId: r })
    ).rejects.toMatchObject({ code: "PAYOUT_EXISTS" })
  })
  it("retains uncertain transfers and retries only the same provider reference", async () => {
    const l = await agreement(),
      r = await recipient(),
      p = await approvePayout(admin, { licenseId: l, recipientId: r })
    provider.mockRejectedValue(new Error("timeout"))
    await expect(sendPayout(admin, p.id)).rejects.toMatchObject({
      code: "PROVIDER_UNCERTAIN",
    })
    const attempt = await db.payoutAttempt.findUniqueOrThrow({
      where: { id: p.id },
    })
    expect(attempt.status).toBe("UNKNOWN")
    // In-flight attempts retain their approved destination when a new recipient is confirmed.
    await recipient()
    await expect(
      approvePayout(admin, { licenseId: l, recipientId: r })
    ).rejects.toMatchObject({ code: "PAYOUT_EXISTS" })
    let missing = true
    provider.mockImplementation((url, init) => {
      if (String(url).includes("/verify/") && missing) {
        missing = false
        return response(null, 404)
      }
      if (init?.method === "POST") {
        expect(
          (JSON.parse(String(init.body)) as { reference: string }).reference
        ).toBe(attempt.reference)
        expect(
          (JSON.parse(String(init.body)) as { recipient: string }).recipient
        ).toBe(attempt.recipientCode)
      }
      return response({
        reference: attempt.reference,
        transfer_code: "TRF_retry",
        status: "success",
        amount: 60000,
        currency: "GHS",
        domain: "test",
      })
    })
    expect((await sendPayout(admin, p.id, undefined, true)).status).toBe(
      "SUCCESS"
    )
  })
})
