import "server-only"
import { createHash } from "node:crypto"
import { z } from "zod"
import { getPrisma } from "@/lib/prisma"
import { paystack, paymentMode, verifyPaystackSignature } from "@/lib/paystack"
import { PlatformError } from "@/lib/platform-error"
import { reconcilePayment } from "./payments"
import { reconcilePayout } from "./licensing"
import { enqueueUserNotification } from "@/services/notifications/outbox"

const identity = z
  .union([z.string().min(1), z.number().int()])
  .transform(String)
const transaction = z.object({
  reference: z.string(),
  domain: z.enum(["test", "live"]),
  currency: z.string().optional(),
})
export async function processPaystackWebhook(
  raw: string,
  signature: string | null
) {
  if (!verifyPaystackSignature(raw, signature))
    throw new PlatformError(
      401,
      "INVALID_SIGNATURE",
      "Invalid webhook signature."
    )
  const envelope = z
    .object({ event: z.string(), data: z.unknown() })
    .parse(JSON.parse(raw))
  const { event } = envelope
  const supported = [
    "charge.success",
    "refund.processed",
    "charge.dispute.resolve",
    "transfer.success",
    "transfer.failed",
    "transfer.reversed",
  ]
  if (!supported.includes(event)) return
  const data = z.record(z.string(), z.unknown()).parse(envelope.data)
  const resourceId = identity.parse(data.id),
    mode = paymentMode()
  if (typeof data.domain === "string" && data.domain !== mode)
    throw new PlatformError(
      409,
      "MODE_MISMATCH",
      "Webhook environment does not match."
    )
  const id = createHash("sha256")
      .update(`${mode}:${event}:${resourceId}`)
      .digest("hex"),
    db = getPrisma()
  if (await db.paymentWebhook.findUnique({ where: { id } })) return
  if (event === "charge.success") {
    const reference = z.string().parse(data.reference)
    const local = await db.billingPayment.findUnique({ where: { reference } })
    if (local && local.mode === mode) {
      const payment = await reconcilePayment(reference)
      if (!["SUCCESS", "REFUNDED", "CHARGEBACK"].includes(payment.status))
        throw new PlatformError(
          503,
          "PAYMENT_NOT_READY",
          "The provider has not confirmed this payment event. Retry delivery."
        )
    }
  } else if (event.startsWith("transfer.")) {
    const attempt = await db.payoutAttempt.findUnique({
      where: { reference: z.string().parse(data.reference) },
    })
    if (attempt && attempt.mode === mode) {
      const payout = await reconcilePayout(attempt.id)
      if (!["SUCCESS", "FAILED", "REVERSED"].includes(payout.status))
        throw new PlatformError(
          503,
          "TRANSFER_NOT_READY",
          "The provider has not confirmed this transfer event. Retry delivery."
        )
    }
  } else {
    const refund = event === "refund.processed"
    const result = await paystack(
      `/${refund ? "refund" : "dispute"}/${encodeURIComponent(resourceId)}`,
      z.object({
        id: identity,
        amount: z.number().int().nonnegative().optional(),
        refund_amount: z.number().int().nullish(),
        currency: z.string().nullish(),
        status: z.string(),
        domain: z.enum(["test", "live"]),
        resolution: z.string().nullish(),
        transaction: z.union([identity, transaction]),
      })
    )
    // Fetch Refund returns a transaction ID; dispute responses may expand it.
    const original =
      typeof result.transaction === "string"
        ? await paystack(
            `/transaction/${encodeURIComponent(result.transaction)}`,
            transaction
          )
        : result.transaction
    if (
      result.id !== resourceId ||
      result.domain !== mode ||
      original.domain !== mode ||
      (result.currency ?? original.currency) !== "GHS"
    )
      throw new PlatformError(
        409,
        "ADJUSTMENT_MISMATCH",
        "Refund or dispute environment does not match."
      )
    const payment = await db.billingPayment.findUnique({
      where: { reference: original.reference },
    })
    if (payment && payment.mode === mode) {
      if (refund && result.status !== "processed")
        throw new PlatformError(
          503,
          "ADJUSTMENT_NOT_READY",
          "The provider has not completed this refund. Retry delivery."
        )
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`billing:${payment.userId}:${mode}`}))`
        if (await tx.paymentWebhook.findUnique({ where: { id } })) return
        const current = await tx.billingPayment.findUniqueOrThrow({
          where: { id: payment.id },
        })
        const refunded =
          refund && result.status === "processed"
            ? Math.min(
                current.amount,
                current.refundAmount + (result.amount ?? 0)
              )
            : current.refundAmount
        const chargeback =
          !refund &&
          result.status === "resolved" &&
          ["merchant-accepted", "auto-accepted"].includes(
            result.resolution ?? ""
          )
        const revoke = refunded >= current.amount || chargeback
        await tx.billingPayment.update({
          where: { id: payment.id },
          data: {
            refundAmount: refunded,
            reviewRequired: !revoke,
            ...(revoke
              ? { status: chargeback ? "CHARGEBACK" : "REFUNDED" }
              : {}),
          },
        })
        if (revoke)
          await tx.premiumGrant.updateMany({
            where: { paymentId: payment.id, revokedAt: null },
            data: { revokedAt: new Date() },
          })
        if (refund && refunded > current.refundAmount)
          await enqueueUserNotification(tx, {
            eventKey: `refund:${mode}:${resourceId}`,
            userId: current.userId,
            event: {
              type: "REFUND_CONFIRMED",
              mode,
              amountMinor: refunded - current.refundAmount,
              currency: current.currency,
              reference: current.reference,
            },
          })
        await tx.paymentWebhook.create({
          data: { id, mode, event, resourceId },
        })
      })
      return
    }
  }
  await db.paymentWebhook.upsert({
    where: { id },
    update: {},
    create: { id, mode, event, resourceId },
  })
}
