import "server-only"
import { createHmac, randomInt, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import type { Prisma } from "@/app/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { PlatformError } from "@/lib/platform-error"
import { sendSms } from "./providers"

export function normalizeGhanaPhone(raw: string) {
  const digits = raw.replace(/[\s()+-]/g, "")
  const normalized = /^0\d{9}$/.test(digits) ? `233${digits.slice(1)}` : digits
  if (!/^233[235]\d{8}$/.test(normalized))
    throw new PlatformError(
      400,
      "INVALID_PHONE",
      "Enter a valid Ghana phone number."
    )
  return `+${normalized}`
}
export const phoneSettingsSchema = z
  .object({
    phone: z.string().max(32).nullable(),
    transactionalSmsConsent: z.boolean().default(false),
  })
  .strict()

async function activeUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`phone:${userId}`}))`
  const user = await tx.user.findUnique({ where: { id: userId } })
  if (!user || user.isSuspended)
    throw new PlatformError(
      401,
      "AUTH_REQUIRED",
      "Sign in with an active account."
    )
  return user
}
export async function savePhoneSettings(userId: string, raw: unknown) {
  const input = phoneSettingsSchema.parse(raw)
  const phone = input.phone?.trim() ? normalizeGhanaPhone(input.phone) : null
  return getPrisma().$transaction(async (tx) => {
    const user = await activeUser(tx, userId)
    const changed = phone !== user.phone
    if (!changed && input.transactionalSmsConsent && !user.phoneVerifiedAt)
      throw new PlatformError(
        409,
        "PHONE_NOT_VERIFIED",
        "Verify your number before enabling SMS."
      )
    if (changed)
      await tx.phoneVerification.updateMany({
        where: { userId },
        data: { codeHash: "", expiresAt: new Date(0) },
      })
    return tx.user.update({
      where: { id: userId },
      data: {
        phone,
        ...(changed ? { phoneVerifiedAt: null } : {}),
        transactionalSmsConsent: changed
          ? false
          : Boolean(phone && input.transactionalSmsConsent),
      },
      select: {
        phone: true,
        phoneVerifiedAt: true,
        transactionalSmsConsent: true,
      },
    })
  })
}
function digest(userId: string, phone: string, code: string) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (!secret) throw new Error("BETTER_AUTH_SECRET is required")
  return createHmac("sha256", secret)
    .update(`${userId}:${phone}:${code}`)
    .digest("hex")
}
export async function requestPhoneCode(
  userId: string,
  send = sendSms,
  now = new Date()
) {
  const code = randomInt(0, 1_000_000).toString().padStart(6, "0")
  const reserved = await getPrisma().$transaction(async (tx) => {
    const user = await activeUser(tx, userId)
    if (!user.phone)
      throw new PlatformError(
        400,
        "PHONE_REQUIRED",
        "Save a phone number first."
      )
    if (user.phoneVerifiedAt)
      throw new PlatformError(
        409,
        "ALREADY_VERIFIED",
        "This number is already verified."
      )
    const prior = await tx.phoneVerification.findUnique({ where: { userId } })
    const sameWindow =
      prior && now.getTime() - prior.windowStartedAt.getTime() < 3_600_000
    if ((prior && prior.resendAt > now) || (sameWindow && prior.sentCount >= 5))
      throw new PlatformError(
        429,
        "CODE_RATE_LIMIT",
        "Wait before requesting another code. Maximum five codes per hour."
      )
    const data = {
      phone: user.phone,
      codeHash: digest(userId, user.phone, code),
      attempts: 0,
      expiresAt: new Date(now.getTime() + 300_000),
      resendAt: new Date(now.getTime() + 60_000),
      sentCount: sameWindow ? prior.sentCount + 1 : 1,
      windowStartedAt: sameWindow ? prior.windowStartedAt : now,
    }
    await tx.phoneVerification.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    })
    return data
  })
  const outcome = await send(
    reserved.phone,
    `Your GhanaVerse verification code is ${code}. It expires in 5 minutes. Never share this code.`
  )
  if (outcome.status === "REJECTED") {
    await getPrisma().phoneVerification.updateMany({
      where: { userId, codeHash: reserved.codeHash },
      data: { codeHash: "", expiresAt: new Date(0) },
    })
    throw new PlatformError(
      503,
      "CODE_UNAVAILABLE",
      "The verification code could not be sent. Try again later."
    )
  }
  // On an uncertain response the code may have arrived; never automatically resend.
  return {
    accepted: outcome.status === "ACCEPTED",
    expiresAt: reserved.expiresAt,
    resendAt: reserved.resendAt,
    message:
      outcome.status === "ACCEPTED"
        ? "Code accepted by the SMS provider. Delivery may take a moment."
        : "Delivery could not be confirmed. Use the code if it arrives, or request another after the resend delay.",
  }
}
export async function verifyPhoneCode(
  userId: string,
  raw: unknown,
  now = new Date()
) {
  const { code } = z
    .object({ code: z.string().regex(/^\d{6}$/) })
    .strict()
    .parse(raw)
  const result = await getPrisma().$transaction(async (tx) => {
    const user = await activeUser(tx, userId)
    const challenge = await tx.phoneVerification.findUnique({
      where: { userId },
    })
    if (
      !challenge ||
      challenge.phone !== user.phone ||
      challenge.expiresAt <= now ||
      challenge.attempts >= 5 ||
      !challenge.codeHash
    )
      return { valid: false }
    const actual = Buffer.from(digest(userId, challenge.phone, code), "hex")
    const expected = Buffer.from(challenge.codeHash, "hex")
    if (
      actual.length !== expected.length ||
      !timingSafeEqual(actual, expected)
    ) {
      await tx.phoneVerification.update({
        where: { userId },
        data: { attempts: { increment: 1 } },
      })
      return { valid: false }
    }
    await tx.user.update({
      where: { id: userId },
      data: { phoneVerifiedAt: now, transactionalSmsConsent: false },
    })
    await tx.phoneVerification.update({
      where: { userId },
      data: { codeHash: "", expiresAt: new Date(0) },
    })
    return { valid: true }
  })
  if (!result.valid)
    throw new PlatformError(
      400,
      "INVALID_CODE",
      "The code is invalid, expired, or has reached its attempt limit."
    )
  return { verified: true }
}
