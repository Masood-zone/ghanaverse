import "server-only"
import { randomUUID } from "node:crypto"
import { getPrisma } from "@/lib/prisma"
import type { NotificationOutbox } from "@/app/generated/prisma/client"
import {
  sendEmail,
  sendSms,
  smsDeliveryReceipt,
  type ProviderOutcome,
} from "./providers"
import { renderNotification, type NotificationEvent } from "./templates"
import { enqueueAdminAlert } from "./outbox"

export const MAX_DELIVERY_ATTEMPTS = 5
const LEASE_MS = 120_000
export function retryDelay(attempts: number) {
  return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempts - 1))
}

export async function claimNotifications(limit = 4, now = new Date()) {
  const prisma = getPrisma()
  // A dead worker could have sent already: never blindly retry its expired lease.
  await prisma.notificationOutbox.updateMany({
    where: {
      status: "PROCESSING",
      claimedAt: { lt: new Date(now.getTime() - LEASE_MS) },
    },
    data: {
      status: "AMBIGUOUS",
      lastError: "WORKER_LEASE_EXPIRED",
      claimToken: null,
    },
  })
  const candidates = await prisma.notificationOutbox.findMany({
    where: { status: "PENDING", nextAttemptAt: { lte: now } },
    orderBy: { createdAt: "asc" },
    take: Math.min(8, Math.max(1, limit)),
    select: { id: true },
  })
  const claimed: NotificationOutbox[] = []
  for (const candidate of candidates) {
    const token = randomUUID()
    const result = await prisma.notificationOutbox.updateMany({
      where: {
        id: candidate.id,
        status: "PENDING",
        nextAttemptAt: { lte: now },
      },
      data: {
        status: "PROCESSING",
        claimedAt: now,
        claimToken: token,
        attempts: { increment: 1 },
      },
    })
    if (result.count) {
      const row = await prisma.notificationOutbox.findUnique({
        where: { id: candidate.id },
      })
      if (row) claimed.push(row)
    }
  }
  return claimed
}

export async function deliverNotification(
  row: NotificationOutbox,
  send = { email: sendEmail, sms: sendSms }
) {
  const prisma = getPrisma()
  if (
    !row.claimToken ||
    !(await prisma.notificationOutbox.findFirst({
      where: { id: row.id, status: "PROCESSING", claimToken: row.claimToken },
      select: { id: true },
    }))
  )
    return "CANCELLED"
  const user = await prisma.user.findUnique({ where: { id: row.recipientId } })
  const event = row.event as NotificationEvent
  const audienceAllowed =
    event.type === "ADMIN_ALERT"
      ? user?.role === "ADMIN"
      : !event.audienceRightsHolderId ||
        Boolean(
          await prisma.rightsHolderMembership.findUnique({
            where: {
              userId_rightsHolderId: {
                userId: row.recipientId,
                rightsHolderId: event.audienceRightsHolderId,
              },
            },
          })
        )
  const permitted =
    audienceAllowed &&
    user &&
    !user.isSuspended &&
    (row.channel === "EMAIL"
      ? user.email === row.recipientAddress
      : user.phone === row.recipientAddress &&
        user.phoneVerifiedAt &&
        user.transactionalSmsConsent)
  if (!permitted) {
    await prisma.notificationOutbox.updateMany({
      where: { id: row.id, status: "PROCESSING", claimToken: row.claimToken },
      data: {
        status: "CANCELLED",
        claimToken: null,
        lastError: "RECIPIENT_NO_LONGER_ELIGIBLE",
      },
    })
    return "CANCELLED"
  }
  let outcome: ProviderOutcome
  try {
    const template = renderNotification(row.event as NotificationEvent)
    outcome =
      row.channel === "EMAIL"
        ? await send.email(
            row.recipientAddress,
            template.subject,
            template.text
          )
        : await send.sms(row.recipientAddress, template.text)
  } catch {
    outcome = { status: "AMBIGUOUS", error: "DELIVERY_RESULT_UNKNOWN" }
  }
  const failed =
    outcome.status === "REJECTED" &&
    (!outcome.retryable || row.attempts >= MAX_DELIVERY_ATTEMPTS)
  const status =
    outcome.status === "REJECTED"
      ? failed
        ? "FAILED"
        : "PENDING"
      : outcome.status
  await prisma.$transaction(async (tx) => {
    const updated = await tx.notificationOutbox.updateMany({
      where: { id: row.id, status: "PROCESSING", claimToken: row.claimToken },
      data: {
        status,
        claimToken: null,
        ...(outcome.status === "ACCEPTED"
          ? {
              providerMessageId: outcome.messageId,
              acceptedAt: new Date(),
              nextAttemptAt: new Date(Date.now() + 300_000),
              lastError: null,
            }
          : { lastError: outcome.error }),
        ...(status === "PENDING"
          ? { nextAttemptAt: new Date(Date.now() + retryDelay(row.attempts)) }
          : {}),
      },
    })
    if (
      updated.count &&
      failed &&
      (row.event as NotificationEvent).type !== "ADMIN_ALERT"
    )
      await enqueueAdminAlert(
        tx,
        `delivery-failed:${row.id}`,
        `Delivery ${row.id} exhausted its retries or was rejected permanently. Check provider configuration and review the failed queue entry.`
      )
  })
  return status
}

export async function processNotificationBatch(limit = 4) {
  await reconcileSmsReceipts(limit)
  const rows = await claimNotifications(limit)
  await Promise.all(rows.map((row) => deliverNotification(row)))
  return rows.length
}

export async function reconcileSmsReceipts(
  limit = 4,
  receipt = smsDeliveryReceipt
) {
  const db = getPrisma()
  const rows = await db.notificationOutbox.findMany({
    where: {
      status: "ACCEPTED",
      channel: "SMS",
      providerMessageId: { not: null },
      nextAttemptAt: { lte: new Date() },
    },
    take: Math.min(8, Math.max(1, limit)),
    orderBy: { nextAttemptAt: "asc" },
  })
  await Promise.all(
    rows.map(async (row) => {
      try {
        const status = await receipt(row.providerMessageId!)
        await db.$transaction(async (tx) => {
          const updated = await tx.notificationOutbox.updateMany({
            where: { id: row.id, status: "ACCEPTED" },
            data: {
              status,
              nextAttemptAt: new Date(Date.now() + 300_000),
              ...(status === "DELIVERED"
                ? { deliveredAt: new Date() }
                : status === "FAILED"
                  ? { lastError: "SMS_CARRIER_DELIVERY_FAILED" }
                  : {}),
            },
          })
          if (
            updated.count &&
            status === "FAILED" &&
            (row.event as NotificationEvent).type !== "ADMIN_ALERT"
          )
            await enqueueAdminAlert(
              tx,
              `delivery-failed:${row.id}`,
              `The carrier could not deliver notification ${row.id}. Review its delivery receipt and recipient.`
            )
        })
      } catch {
        await db.notificationOutbox.updateMany({
          where: { id: row.id, status: "ACCEPTED" },
          data: {
            nextAttemptAt: new Date(Date.now() + 300_000),
            lastError: "SMS_RECEIPT_UNAVAILABLE",
          },
        })
      }
    })
  )
}
