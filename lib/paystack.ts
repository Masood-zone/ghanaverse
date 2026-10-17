import "server-only"
import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod"
import { PlatformError } from "@/lib/platform-error"

export function paymentMode() {
  const key = process.env.PAYSTACK_SECRET_KEY ?? ""
  if (key.startsWith("sk_test_")) return "test" as const
  if (key.startsWith("sk_live_")) return "live" as const
  throw new PlatformError(
    503,
    "PAYMENTS_UNAVAILABLE",
    "Payments are not configured. Please try again later."
  )
}
export function paymentConfiguration() {
  try {
    return { configured: true, mode: paymentMode() }
  } catch {
    return { configured: false, mode: null }
  }
}
export async function paystack<T>(
  path: string,
  schema: z.ZodType<T>,
  body?: unknown
): Promise<T> {
  paymentMode()
  let response: Response
  try {
    response = await fetch(`https://api.paystack.co${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: {
        Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
      redirect: "error",
    })
  } catch {
    throw new PlatformError(
      503,
      "PROVIDER_UNCERTAIN",
      "Paystack did not respond. Check the existing transaction status before trying again."
    )
  }
  const envelope = z
    .object({ status: z.boolean(), data: z.unknown().optional() })
    .safeParse(await response.json().catch(() => null))
  if (response.status === 404)
    throw new PlatformError(
      404,
      "PROVIDER_NOT_FOUND",
      "Paystack has no record for this reference yet."
    )
  if (!response.ok || !envelope.success || !envelope.data.status)
    throw new PlatformError(
      502,
      "PROVIDER_REJECTED",
      "Paystack could not complete this request. Check the transaction status or your provider settings."
    )
  const result = schema.safeParse(envelope.data.data)
  if (!result.success)
    throw new PlatformError(
      502,
      "PROVIDER_INVALID",
      "Paystack returned an unexpected response. Please refresh its status."
    )
  return result.data
}
export function verifyPaystackSignature(raw: string, signature: string | null) {
  paymentMode()
  if (!signature || !/^[a-f0-9]{128}$/i.test(signature)) return false
  const expected = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!)
    .update(raw)
    .digest()
  return timingSafeEqual(expected, Buffer.from(signature, "hex"))
}
export const transactionResult = z.object({
  id: z.union([z.string(), z.number()]).transform(String),
  reference: z.string(),
  status: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  domain: z.enum(["test", "live"]),
  customer: z.object({ email: z.string() }),
  channel: z.string().nullish(),
  fees: z.number().int().nullish(),
})
export const transferResult = z.object({
  reference: z.string(),
  transfer_code: z.string(),
  status: z.string(),
  amount: z.number().int(),
  currency: z.string(),
  domain: z.enum(["test", "live"]),
  recipient: z
    .union([z.string(), z.number(), z.object({ recipient_code: z.string() })])
    .optional(),
})
