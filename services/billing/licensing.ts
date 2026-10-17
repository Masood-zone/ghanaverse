import "server-only"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { getPrisma } from "@/lib/prisma"
import { paystack, paymentMode, transferResult } from "@/lib/paystack"
import { PlatformError } from "@/lib/platform-error"
import {
  licenseSchema,
  recipientSchema,
  payoutSchema,
} from "@/lib/validation/billing"
import { audit, billingActor } from "./payments"
import {
  enqueueAdminAlert,
  enqueueRightsHolderNotification,
} from "@/services/notifications/outbox"

export async function holderScope(actorId: string) {
  const user = await billingActor(actorId)
  if (user.role === "ADMIN") return null
  if (user.role !== "RIGHTS_HOLDER")
    throw new PlatformError(
      403,
      "RIGHTS_HOLDER_REQUIRED",
      "Rights-holder access required."
    )
  const memberships = await getPrisma().rightsHolderMembership.findMany({
    where: { userId: actorId },
  })
  return memberships.map((m) => m.rightsHolderId)
}
export async function earnings(actorId: string, exportAll = false) {
  const scope = await holderScope(actorId),
    mode = paymentMode(),
    db = getPrisma()
  const where = scope === null ? {} : { rightsHolderId: { in: scope } }
  const [licenses, recipients, holders, titles] = await Promise.all([
    db.contentLicense.findMany({
      where,
      include: {
        content: { select: { title: true } },
        rightsHolder: { select: { name: true } },
        payouts: {
          where: { mode },
          select: {
            id: true,
            reference: true,
            amount: true,
            recipientLabel: true,
            status: true,
            lastError: true,
            createdAt: true,
          },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { createdAt: "desc" },
      ...(exportAll ? {} : { take: 200 }),
    }),
    db.payoutRecipient.findMany({
      where: { ...where, mode },
      select: {
        id: true,
        rightsHolderId: true,
        type: true,
        name: true,
        bankCode: true,
        maskedAccount: true,
        status: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    db.rightsHolder.findMany({
      where: scope === null ? {} : { id: { in: scope } },
      select: { id: true, name: true },
    }),
    scope === null
      ? db.content.findMany({
          select: { id: true, title: true, rightsHolderId: true },
          orderBy: { title: "asc" },
        })
      : [],
  ])
  return { mode, licenses, recipients, holders, titles }
}
export async function createLicense(actorId: string, raw: unknown) {
  const input = licenseSchema.parse(raw)
  return getPrisma().$transaction(async (tx) => {
    await billingActor(actorId, true, tx)
    const content = await tx.content.findUnique({
      where: { id: input.contentId },
    })
    if (!content || content.rightsHolderId !== input.rightsHolderId)
      throw new PlatformError(
        400,
        "HOLDER_MISMATCH",
        "Choose the rights holder currently assigned to this title."
      )
    const license = await tx.contentLicense.create({ data: input })
    await audit(tx, actorId, "CREATE_LICENSE", "licenses", license.id)
    return { id: license.id }
  })
}
export async function licenseStatus(actorId: string, id: string, raw: unknown) {
  const { status } = z
    .object({ status: z.enum(["APPROVED", "REVOKED"]) })
    .strict()
    .parse(raw)
  return getPrisma().$transaction(async (tx) => {
    await billingActor(actorId, true, tx)
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
    const license = await tx.contentLicense.findUnique({
      where: { id },
      include: { content: true },
    })
    if (!license)
      throw new PlatformError(404, "LICENSE_NOT_FOUND", "Licence not found.")
    if (
      status === "APPROVED" &&
      (license.status !== "DRAFT" ||
        license.content.rightsHolderId !== license.rightsHolderId ||
        license.endsAt <= new Date())
    )
      throw new PlatformError(
        409,
        "LICENSE_NOT_APPROVABLE",
        "Only an unexpired draft for the assigned rights holder can be approved."
      )
    await tx.contentLicense.update({
      where: { id },
      data: {
        status,
        ...(status === "APPROVED" ? { approvedById: actorId } : {}),
      },
    })
    if (status === "REVOKED")
      await tx.payoutAttempt.updateMany({
        where: { licenseId: id, status: "APPROVED" },
        data: { status: "CANCELLED" },
      })
    await audit(tx, actorId, `${status}_LICENSE`, "licenses", id)
    return { id }
  })
}
const bankSchema = z.object({
  name: z.string(),
  code: z.string(),
  active: z.boolean().optional(),
})
export const payoutBanks = (type: "ghipss" | "mobile_money") =>
  paystack(`/bank?currency=GHS&type=${type}`, z.array(bankSchema))
export async function createRecipient(actorId: string, raw: unknown) {
  const input = recipientSchema.parse(raw),
    scope = await holderScope(actorId),
    mode = paymentMode()
  if (scope !== null && !scope.includes(input.rightsHolderId))
    throw new PlatformError(404, "HOLDER_NOT_FOUND", "Rights holder not found.")
  if (
    !(await getPrisma().rightsHolder.findUnique({
      where: { id: input.rightsHolderId },
    }))
  )
    throw new PlatformError(404, "HOLDER_NOT_FOUND", "Rights holder not found.")
  const banks = await payoutBanks(input.type)
  if (
    !banks.some(
      (b) =>
        b.code === input.bankCode &&
        b.active !== false &&
        b.name.toLowerCase() !== "bank of ghana"
    )
  )
    throw new PlatformError(
      400,
      "INVALID_BANK",
      "Choose an available Ghana bank or Mobile Money provider."
    )
  let name = input.name
  if (input.type === "ghipss") {
    const resolved = await paystack(
      `/bank/resolve?account_number=${encodeURIComponent(input.accountNumber)}&bank_code=${encodeURIComponent(input.bankCode)}`,
      z.object({ account_name: z.string().min(1) })
    )
    name = resolved.account_name
  }
  const result = await paystack(
    "/transferrecipient",
    z.object({ recipient_code: z.string(), domain: z.enum(["test", "live"]) }),
    {
      type: input.type,
      name,
      account_number: input.accountNumber,
      bank_code: input.bankCode,
      currency: "GHS",
    }
  )
  if (result.domain !== mode)
    throw new PlatformError(
      409,
      "MODE_MISMATCH",
      "Recipient environment does not match."
    )
  return getPrisma().$transaction(async (tx) => {
    // Recheck ownership after the external request; raw account numbers are never persisted.
    const user = await billingActor(actorId, false, tx)
    if (
      user.role !== "ADMIN" &&
      (user.role !== "RIGHTS_HOLDER" ||
        !(await tx.rightsHolderMembership.findUnique({
          where: {
            userId_rightsHolderId: {
              userId: actorId,
              rightsHolderId: input.rightsHolderId,
            },
          },
        })))
    )
      throw new PlatformError(
        403,
        "HOLDER_ACCESS_REVOKED",
        "Rights-holder access has changed."
      )
    const existing = await tx.payoutRecipient.findUnique({
      where: {
        mode_providerCode: { mode, providerCode: result.recipient_code },
      },
    })
    if (existing && existing.rightsHolderId !== input.rightsHolderId)
      throw new PlatformError(
        409,
        "RECIPIENT_IN_USE",
        "This recipient is already registered to another rights holder."
      )
    if (existing) return { id: existing.id }
    const recipient = await tx.payoutRecipient.create({
      data: {
        rightsHolderId: input.rightsHolderId,
        mode,
        type: input.type,
        name,
        bankCode: input.bankCode,
        maskedAccount: `•••• ${input.accountNumber.slice(-4)}`,
        providerCode: result.recipient_code,
      },
    })
    await audit(tx, actorId, "CREATE_RECIPIENT", "recipients", recipient.id)
    return { id: recipient.id }
  })
}
export async function approveRecipient(actorId: string, id: string) {
  return getPrisma().$transaction(async (tx) => {
    await billingActor(actorId, true, tx)
    const recipient = await tx.payoutRecipient.findUnique({ where: { id } })
    if (!recipient || recipient.mode !== paymentMode())
      throw new PlatformError(
        404,
        "RECIPIENT_NOT_FOUND",
        "Recipient not found."
      )
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`recipient:${recipient.rightsHolderId}`}))`
    const old = await tx.payoutRecipient.findMany({
      where: {
        rightsHolderId: recipient.rightsHolderId,
        mode: recipient.mode,
        status: "APPROVED",
        id: { not: id },
      },
    })
    await tx.payoutAttempt.updateMany({
      where: { recipientId: { in: old.map((r) => r.id) }, status: "APPROVED" },
      data: { status: "CANCELLED" },
    })
    await tx.payoutRecipient.updateMany({
      where: { id: { in: old.map((r) => r.id) } },
      data: { status: "REPLACED" },
    })
    await tx.payoutRecipient.update({
      where: { id },
      data: { status: "APPROVED", approvedById: actorId },
    })
    await audit(tx, actorId, "APPROVE_RECIPIENT", "recipients", id)
    return { id }
  })
}
const terminalRetry = ["FAILED", "REVERSED", "CANCELLED"]
export async function approvePayout(actorId: string, raw: unknown) {
  const input = payoutSchema.parse(raw),
    mode = paymentMode()
  return getPrisma().$transaction(async (tx) => {
    await billingActor(actorId, true, tx)
    const license = await tx.contentLicense.findUnique({
      where: { id: input.licenseId },
    })
    if (
      !license ||
      !license.approvedById ||
      !["APPROVED", "REVOKED"].includes(license.status)
    )
      throw new PlatformError(
        409,
        "LICENSE_NOT_APPROVED",
        "A previously approved licensing agreement is required."
      )
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`payout:${license.id}:${mode}`}))`
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`recipient:${license.rightsHolderId}`}))`
    if (
      await tx.payoutAttempt.count({
        where: {
          licenseId: license.id,
          mode,
          status: { notIn: terminalRetry },
        },
      })
    )
      throw new PlatformError(
        409,
        "PAYOUT_EXISTS",
        "This fee is paid or already has a payout in progress. Reconcile that attempt first."
      )
    const recipient = await tx.payoutRecipient.findFirst({
      where: {
        id: input.recipientId,
        rightsHolderId: license.rightsHolderId,
        mode,
        status: "APPROVED",
      },
    })
    if (!recipient)
      throw new PlatformError(
        409,
        "RECIPIENT_NOT_APPROVED",
        "An approved recipient for this rights holder is required."
      )
    const attempt = await tx.payoutAttempt.create({
      data: {
        licenseId: license.id,
        recipientId: recipient.id,
        mode,
        reference: `gvpay-${randomUUID()}`,
        amount: license.amount,
        recipientCode: recipient.providerCode,
        recipientLabel: `${recipient.name} · ${recipient.maskedAccount}`,
        approvedById: actorId,
      },
    })
    await audit(tx, actorId, "APPROVE_PAYOUT", "payouts", attempt.id)
    return { id: attempt.id }
  })
}
export async function reconcilePayout(id: string) {
  const attempt = await getPrisma().payoutAttempt.findUnique({ where: { id } })
  if (!attempt || attempt.mode !== paymentMode())
    throw new PlatformError(404, "PAYOUT_NOT_FOUND", "Payout not found.")
  const result = await paystack(
    `/transfer/verify/${encodeURIComponent(attempt.reference)}`,
    transferResult
  )
  if (
    result.reference !== attempt.reference ||
    result.amount !== attempt.amount ||
    result.currency !== attempt.currency ||
    result.domain !== attempt.mode ||
    (typeof result.recipient === "object" &&
      result.recipient.recipient_code !== attempt.recipientCode)
  )
    throw new PlatformError(
      409,
      "TRANSFER_MISMATCH",
      "Provider transfer does not match this payout."
    )
  const statuses: Record<string, string> = {
    success: "SUCCESS",
    failed: "FAILED",
    reversed: "REVERSED",
    otp: "OTP_REQUIRED",
    abandoned: "FAILED",
    rejected: "FAILED",
    blocked: "FAILED",
    pending: "PENDING",
    received: "PENDING",
  }
  const status = statuses[result.status]
  if (!status)
    throw new PlatformError(
      502,
      "UNKNOWN_TRANSFER_STATUS",
      "The transfer needs provider review."
    )
  // Serializes reconciliation with payout approval so a terminal retry cannot overlap
  // a provider-confirmed success for an older attempt.
  return getPrisma().$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`payout:${attempt.licenseId}:${attempt.mode}`}))`
    const current = await tx.payoutAttempt.findUniqueOrThrow({ where: { id } })
    if (current.status === "REVERSED" && status !== "REVERSED")
      return { id, status: current.status }
    if (
      current.status === "SUCCESS" &&
      !["SUCCESS", "REVERSED"].includes(status)
    )
      return { id, status: current.status }
    await tx.payoutAttempt.update({
      where: { id },
      data: {
        status,
        transferCode: result.transfer_code,
        leaseUntil: null,
        lastError: null,
      },
    })
    if (
      current.status !== status &&
      ["SUCCESS", "FAILED", "REVERSED"].includes(status)
    ) {
      const license = await tx.contentLicense.findUniqueOrThrow({
        where: { id: current.licenseId },
        select: { rightsHolderId: true },
      })
      await enqueueRightsHolderNotification(
        tx,
        license.rightsHolderId,
        `payout:${current.id}:${status}`,
        {
          type: "PAYOUT_RESULT",
          mode: paymentMode(),
          amountMinor: current.amount,
          currency: current.currency,
          reference: current.reference,
          status:
            status === "SUCCESS"
              ? "PAID"
              : status === "REVERSED"
                ? "REVERSED"
                : "FAILED",
        }
      )
      if (status !== "SUCCESS")
        await enqueueAdminAlert(
          tx,
          `payout-alert:${current.id}:${status}`,
          `Payout ${current.reference} ${status.toLowerCase()}. Review the provider result and recipient in /admin/royalties before approving another transfer.`
        )
    }
    return { id, status }
  })
}
export async function sendPayout(
  actorId: string,
  id: string,
  otp?: string,
  retryUnknown = false
) {
  const mode = paymentMode()
  if (mode === "live" && process.env.PAYOUTS_LIVE_ENABLED !== "true")
    throw new PlatformError(
      503,
      "LIVE_PAYOUTS_DISABLED",
      "Live payouts require verified launch configuration."
    )
  const attempt = await getPrisma().$transaction(async (tx) => {
    await billingActor(actorId, true, tx)
    const row = await tx.payoutAttempt.findUnique({
      where: { id },
      include: { license: true, recipient: true },
    })
    if (!row || row.mode !== mode)
      throw new PlatformError(404, "PAYOUT_NOT_FOUND", "Payout not found.")
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`payout:${row.licenseId}:${mode}`}))`
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`recipient:${row.license.rightsHolderId}`}))`
    const current = await tx.payoutAttempt.findUniqueOrThrow({ where: { id } })
    if (current.leaseUntil && current.leaseUntil > new Date())
      throw new PlatformError(
        409,
        "PAYOUT_BUSY",
        "This payout is already being processed."
      )
    if (
      current.status !== "APPROVED" &&
      !(otp && current.status === "OTP_REQUIRED") &&
      !(retryUnknown && ["UNKNOWN", "SENDING"].includes(current.status))
    )
      throw new PlatformError(
        409,
        "RECONCILE_REQUIRED",
        "Refresh this payout's status before taking another action."
      )
    const recipient = await tx.payoutRecipient.findUniqueOrThrow({
      where: { id: row.recipientId },
    })
    if (!otp && !retryUnknown && recipient.status !== "APPROVED")
      throw new PlatformError(
        409,
        "APPROVAL_CHANGED",
        "Recipient approval has changed. Reconcile this attempt before creating another."
      )
    await tx.payoutAttempt.update({
      where: { id },
      data: {
        status: otp ? "OTP_REQUIRED" : "SENDING",
        leaseUntil: new Date(Date.now() + 60000),
      },
    })
    await audit(
      tx,
      actorId,
      otp ? "FINALIZE_PAYOUT" : "SEND_PAYOUT",
      "payouts",
      id
    )
    return current
  })
  try {
    if (retryUnknown) {
      try {
        return await reconcilePayout(id)
      } catch (error) {
        if (
          !(error instanceof PlatformError) ||
          error.code !== "PROVIDER_NOT_FOUND"
        )
          throw error
      }
    }
    if (otp) {
      if (!attempt.transferCode)
        throw new PlatformError(
          409,
          "OTP_NOT_READY",
          "Refresh transfer status first."
        )
      await paystack("/transfer/finalize_transfer", z.unknown(), {
        transfer_code: attempt.transferCode,
        otp,
      })
    } else {
      const result = await paystack("/transfer", transferResult, {
        source: "balance",
        amount: attempt.amount,
        currency: "GHS",
        recipient: attempt.recipientCode,
        reference: attempt.reference,
        reason: `GhanaVerse licensing ${attempt.licenseId}`,
      })
      if (
        result.reference !== attempt.reference ||
        result.amount !== attempt.amount ||
        result.currency !== "GHS" ||
        result.domain !== mode
      )
        throw new PlatformError(
          409,
          "TRANSFER_MISMATCH",
          "Provider transfer needs review."
        )
      await getPrisma().payoutAttempt.update({
        where: { id },
        data: { transferCode: result.transfer_code },
      })
    }
    return await reconcilePayout(id)
  } catch (error) {
    await getPrisma().$transaction(async (tx) => {
      const changed = await tx.payoutAttempt.updateMany({
        where: { id, status: { in: ["SENDING", "OTP_REQUIRED"] } },
        data: {
          status: "UNKNOWN",
          leaseUntil: null,
          lastError:
            "Provider outcome needs reconciliation. Refresh status before another transfer.",
        },
      })
      if (changed.count)
        await enqueueAdminAlert(
          tx,
          `payout-alert:${id}:UNKNOWN`,
          `Payout ${attempt.reference} has an uncertain provider outcome. Reconcile it in /admin/royalties before authorizing another transfer.`
        )
    })
    throw error
  }
}
