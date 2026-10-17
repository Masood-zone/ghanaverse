import "server-only"
import { randomUUID } from "node:crypto"
import type { Prisma } from "@/app/generated/prisma/client"
import { z } from "zod"
import { getPrisma } from "@/lib/prisma"
import {
  paystack,
  paymentMode,
  paymentConfiguration,
  transactionResult,
} from "@/lib/paystack"
import { PlatformError } from "@/lib/platform-error"
import { checkoutSchema, mobileMoneyProviders } from "@/lib/validation/billing"
import { premiumAccess } from "./access"

export async function billingActor(
  userId: string,
  admin = false,
  tx: Prisma.TransactionClient = getPrisma()
) {
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user || user.isSuspended)
    throw new PlatformError(
      401,
      "AUTH_REQUIRED",
      "Sign in with an active account."
    )
  if (admin && user.role !== "ADMIN")
    throw new PlatformError(
      403,
      "ADMIN_REQUIRED",
      "Administrator access required."
    )
  return user
}
export function audit(
  tx: Prisma.TransactionClient,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string
) {
  return tx.auditLog.create({ data: { actorId, action, entityType, entityId } })
}
export const ensurePlan = () =>
  getPrisma().billingPlan.upsert({
    where: { id: "premium" },
    update: { id: "premium" },
    create: { id: "premium" },
  })
export async function billingSummary(userId?: string) {
  const plan = await ensurePlan()
  const configuration = paymentConfiguration()
  let canCheckout =
    configuration.configured &&
    plan.enabled &&
    (configuration.mode === "test" ||
      (process.env.BILLING_LIVE_ENABLED === "true" && plan.commercialConfirmed))
  if (canCheckout && configuration.mode === "live") {
    const now = new Date()
    const licensed = await getPrisma().contentLicense.findMany({
      where: {
        status: "APPROVED",
        commercialUse: true,
        startsAt: { lte: now },
        endsAt: { gt: now },
        content: { isPremium: true, publicationStatus: "PUBLISHED" },
      },
      select: {
        rightsHolderId: true,
        content: {
          select: {
            rightsHolderId: true,
            videoAssets: {
              where: {
                isPlayable: true,
                sourceType: "MANAGED",
                storedObject: { state: "READY" },
              },
              select: { id: true },
            },
            seasons: {
              select: {
                episodes: {
                  select: {
                    videoAssets: {
                      where: {
                        isPlayable: true,
                        sourceType: "MANAGED",
                        storedObject: { state: "READY" },
                      },
                      select: { id: true },
                    },
                  },
                },
              },
            },
          },
        },
      },
    })
    canCheckout = licensed.some(
      (l) =>
        l.rightsHolderId === l.content.rightsHolderId &&
        (l.content.videoAssets.length > 0 ||
          l.content.seasons.some((s) =>
            s.episodes.some((e) => e.videoAssets.length > 0)
          ))
    )
  }
  const [access, payments, pendingCheckout] = await Promise.all([
    premiumAccess(userId),
    userId
      ? getPrisma().billingPayment.findMany({
          where: { userId, mode: configuration.mode ?? "unconfigured" },
          orderBy: { createdAt: "desc" },
          take: 50,
          select: {
            id: true,
            reference: true,
            amount: true,
            currency: true,
            days: true,
            status: true,
            channel: true,
            createdAt: true,
            paidAt: true,
            refundAmount: true,
            reviewRequired: true,
          },
        })
      : [],
    userId
      ? getPrisma().billingPayment.findFirst({
          where: {
            userId,
            mode: configuration.mode ?? "unconfigured",
            status: "PENDING",
          },
          orderBy: { createdAt: "desc" },
          select: {
            reference: true,
            idempotencyKey: true,
            channel: true,
            mobileMoneyNetwork: true,
            maskedPayerPhone: true,
            amount: true,
            days: true,
            checkoutUrl: true,
          },
        })
      : null,
  ])
  return {
    plan: {
      amount: plan.amount,
      days: plan.days,
      enabled: plan.enabled,
      commercialConfirmed: plan.commercialConfirmed,
    },
    configuration,
    canCheckout,
    access,
    payments,
    pendingCheckout,
  }
}
export async function initializeCheckout(userId: string, raw: unknown) {
  const input = checkoutSchema.parse(raw),
    mode = paymentMode()
  const user = await billingActor(userId)
  const summary = await billingSummary(userId)
  if (!summary.canCheckout)
    throw new PlatformError(
      503,
      "CHECKOUT_DISABLED",
      "Checkout is currently unavailable. Please try again later."
    )
  // Reconcile another attempt before allowing a new purchase, including after cancellation.
  const prior = summary.pendingCheckout
  if (prior && prior.idempotencyKey !== input.idempotencyKey) {
    const checked = await reconcilePayment(prior.reference, userId)
    if (checked.status === "SUCCESS")
      throw new PlatformError(
        409,
        "PAYMENT_ALREADY_PROCESSED",
        "Your previous payment succeeded. Review your access before renewing again."
      )
    if (checked.status === "PENDING")
      throw new PlatformError(
        409,
        "PAYMENT_PENDING",
        "Your previous payment is still pending. Check its status or resume that checkout."
      )
  }
  if (
    prior &&
    prior.idempotencyKey === input.idempotencyKey &&
    !prior.checkoutUrl
  ) {
    try {
      await reconcilePayment(prior.reference, userId)
      throw new PlatformError(
        409,
        "PAYMENT_PENDING",
        "This reference already exists at Paystack. Check its payment status before continuing."
      )
    } catch (error) {
      if (
        !(error instanceof PlatformError) ||
        error.code !== "PROVIDER_NOT_FOUND"
      )
        throw error
      // Provider confirms initialization never reached it. Reuse the durable reference.
    }
  }
  const payment = await getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`checkout:${userId}:${mode}`}))`
    const pending = await tx.billingPayment.findFirst({
      where: { userId, mode, status: "PENDING" },
    })
    if (pending && pending.idempotencyKey !== input.idempotencyKey)
      throw new PlatformError(
        409,
        "PAYMENT_PENDING",
        "An existing payment needs verification before another purchase."
      )
    return tx.billingPayment.upsert({
      where: {
        userId_mode_idempotencyKey: {
          userId,
          mode,
          idempotencyKey: input.idempotencyKey,
        },
      },
      update: {},
      create: {
        reference: `gv-${randomUUID()}`,
        idempotencyKey: input.idempotencyKey,
        userId,
        planId: "premium",
        mode,
        amount: summary.plan.amount,
        days: summary.plan.days,
        email: user.email,
        channel: input.channel,
        mobileMoneyNetwork:
          input.channel === "mobile_money" ? input.mobileMoneyNetwork : null,
        maskedPayerPhone:
          input.channel === "mobile_money"
            ? `•••• ${input.payerPhone.slice(-4)}`
            : null,
      },
    })
  })
  if (payment.status !== "PENDING")
    throw new PlatformError(
      409,
      "PAYMENT_ALREADY_PROCESSED",
      "This payment has already been processed. Refresh your account."
    )
  if (payment.checkoutUrl)
    return { reference: payment.reference, url: payment.checkoutUrl }
  // The durable reference survives uncertain requests. Paystack rejects duplicate initialization;
  // retries must reconcile that reference instead of silently creating another payment.
  const base = new URL(
    process.env.NEXT_PUBLIC_APP_URL ??
      process.env.BETTER_AUTH_URL ??
      "http://localhost:3000"
  )
  if (mode === "live" && base.protocol !== "https:")
    throw new PlatformError(
      503,
      "HTTPS_REQUIRED",
      "Live checkout requires a secure application URL."
    )
  const result = await paystack(
    "/transaction/initialize",
    z.object({ authorization_url: z.url(), reference: z.string() }),
    {
      email: payment.email,
      amount: payment.amount,
      currency: "GHS",
      reference: payment.reference,
      channels: [payment.channel],
      callback_url: new URL("/plans/result", base).href,
      metadata: JSON.stringify({
        paymentId: payment.id,
        userId,
        cancel_action: new URL(
          `/plans?step=payment&reference=${encodeURIComponent(payment.reference)}`,
          base
        ).href,
        ...(payment.mobileMoneyNetwork
          ? {
              custom_filters: {
                supported_mobile_money_providers: [
                  mobileMoneyProviders[
                    payment.mobileMoneyNetwork as keyof typeof mobileMoneyProviders
                  ],
                ],
              },
            }
          : {}),
      }),
      bearer: "account",
    }
  )
  const checkout = new URL(result.authorization_url)
  if (
    checkout.protocol !== "https:" ||
    checkout.hostname !== "checkout.paystack.com" ||
    result.reference !== payment.reference
  )
    throw new PlatformError(
      502,
      "INVALID_CHECKOUT",
      "Paystack returned an invalid checkout destination."
    )
  await getPrisma().billingPayment.update({
    where: { id: payment.id },
    data: { checkoutUrl: checkout.href },
  })
  return { reference: payment.reference, url: checkout.href }
}
export async function reconcilePayment(reference: string, userId?: string) {
  const mode = paymentMode()
  const payment = await getPrisma().billingPayment.findUnique({
    where: { reference },
  })
  if (
    !payment ||
    payment.mode !== mode ||
    (userId && payment.userId !== userId)
  )
    throw new PlatformError(404, "PAYMENT_NOT_FOUND", "Payment was not found.")
  if (userId) await billingActor(userId)
  const result = await paystack(
    `/transaction/verify/${encodeURIComponent(reference)}`,
    transactionResult
  )
  if (
    result.reference !== reference ||
    result.domain !== mode ||
    result.amount !== payment.amount ||
    result.currency !== payment.currency ||
    result.customer.email.toLowerCase() !== payment.email.toLowerCase()
  )
    throw new PlatformError(
      409,
      "PAYMENT_MISMATCH",
      "Payment details do not match the original order. Contact support."
    )
  const saved = await getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`billing:${payment.userId}:${mode}`}))`
    const current = await tx.billingPayment.findUniqueOrThrow({
      where: { reference },
    })
    if (result.status === "success") {
      if (!["REFUNDED", "CHARGEBACK"].includes(current.status)) {
        const existing = await tx.premiumGrant.findUnique({
          where: { paymentId: current.id },
        })
        if (!existing) {
          const last = await tx.premiumGrant.findFirst({
            where: { userId: current.userId, mode, revokedAt: null },
            orderBy: { endsAt: "desc" },
          })
          const startsAt = new Date(
            Math.max(Date.now(), last?.endsAt.getTime() ?? 0)
          )
          await tx.premiumGrant.create({
            data: {
              paymentId: current.id,
              userId: current.userId,
              mode,
              startsAt,
              endsAt: new Date(startsAt.getTime() + current.days * 86_400_000),
            },
          })
        }
        await tx.billingPayment.update({
          where: { id: current.id },
          data: {
            status: "SUCCESS",
            paidAt: current.paidAt ?? new Date(),
            providerId: result.id,
            fee: result.fees,
            channel: result.channel ?? current.channel,
          },
        })
      }
    } else if (
      current.status !== "SUCCESS" &&
      !["REFUNDED", "CHARGEBACK"].includes(current.status)
    ) {
      const status =
        result.status === "failed"
          ? "FAILED"
          : result.status === "abandoned"
            ? "ABANDONED"
            : "PENDING"
      await tx.billingPayment.update({
        where: { id: current.id },
        data: { status },
      })
    }
    const saved = await tx.billingPayment.findUniqueOrThrow({
      where: { id: current.id },
      select: {
        reference: true,
        status: true,
        amount: true,
        days: true,
        paidAt: true,
        grant: { select: { startsAt: true, endsAt: true, revokedAt: true } },
      },
    })
    const renewal = saved.grant
      ? Boolean(
          await tx.premiumGrant.findFirst({
            where: {
              userId: current.userId,
              mode,
              paymentId: { not: current.id },
              endsAt: saved.grant.startsAt,
            },
            select: { id: true },
          })
        )
      : false
    return { ...saved, renewal }
  })
  const access = await premiumAccess(payment.userId)
  return {
    ...saved,
    access,
    // This particular purchase must still have valid access; another later pass
    // must not make an old or revoked receipt display a fresh welcome.
    active:
      saved.status === "SUCCESS" &&
      !saved.grant?.revokedAt &&
      Boolean(saved.grant && saved.grant.endsAt.getTime() > Date.now()) &&
      access.active,
  }
}
