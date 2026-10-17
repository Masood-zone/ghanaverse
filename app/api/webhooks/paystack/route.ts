import { routeError, PlatformError } from "@/lib/route-error"
import { processPaystackWebhook } from "@/services/billing/webhooks"
export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length") ?? 0) > 262144)
      throw new PlatformError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Webhook payload is too large."
      )
    const raw = await request.text()
    if (Buffer.byteLength(raw) > 262144)
      throw new PlatformError(
        413,
        "PAYLOAD_TOO_LARGE",
        "Webhook payload is too large."
      )
    await processPaystackWebhook(
      raw,
      request.headers.get("x-paystack-signature")
    )
    return new Response(null, { status: 200 })
  } catch (error) {
    return routeError(error, "Webhook processing failed. Retry delivery.")
  }
}
