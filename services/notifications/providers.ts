import "server-only"
import nodemailer from "nodemailer"
import SMTPConnection from "nodemailer/lib/smtp-connection"
import { z } from "zod"

export type ProviderOutcome =
  | { status: "ACCEPTED"; messageId: string }
  | { status: "REJECTED"; error: string; retryable: boolean }
  | { status: "AMBIGUOUS"; error: string }

export function providerDeadline() {
  return Math.min(
    30_000,
    Math.max(1000, Number(process.env.NOTIFICATION_TIMEOUT_MS) || 10_000)
  )
}

const smsResponse = z.object({
  status: z.string(),
  code: z.string(),
  desc: z.unknown(),
})
const smsRecipient = z.object({
  status: z.literal("success"),
  recipient: z.string(),
  message_id: z.string().min(1),
})

export async function sendSms(
  to: string,
  text: string
): Promise<ProviderOutcome> {
  const apiKey = process.env.UELLOSEND_API_KEY
  const sender = process.env.UELLOSEND_SENDER_ID
  if (!apiKey || !sender)
    return { status: "REJECTED", error: "SMS_NOT_CONFIGURED", retryable: true }
  const endpoint =
    process.env.UELLOSEND_API_URL || "https://uellosend.com/quicksend/"
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), providerDeadline())
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: apiKey,
        sender_id: sender,
        recipient: to,
        message: text,
      }),
    })
    const body = smsResponse.safeParse(await response.json())
    if (body.success && body.data.status === "Error")
      return {
        status: "REJECTED",
        error: `SMS_REJECTED_${/^\d{3}$/.test(body.data.code) ? body.data.code : "UNKNOWN"}`,
        retryable: body.data.code === "429" || body.data.code.startsWith("5"),
      }
    if (
      response.ok &&
      body.success &&
      body.data.status === "Success" &&
      body.data.code === "200"
    ) {
      const rows = z.array(smsRecipient).safeParse(body.data.desc)
      if (
        rows.success &&
        rows.data.length === 1 &&
        rows.data[0].recipient === to.replace(/^\+/, "")
      )
        return { status: "ACCEPTED", messageId: rows.data[0].message_id }
    }
    // A malformed/5xx response can follow a charge or provider acceptance.
    return { status: "AMBIGUOUS", error: "SMS_ACCEPTANCE_UNKNOWN" }
  } catch {
    return { status: "AMBIGUOUS", error: "SMS_TIMEOUT_OR_CONNECTION_LOST" }
  } finally {
    clearTimeout(timer)
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  text: string
): Promise<ProviderOutcome> {
  const {
    SMTP_HOST: host,
    SMTP_USER: user,
    SMTP_PASS: pass,
    SMTP_FROM: from,
  } = process.env
  if (!host || !user || !pass || !from)
    return {
      status: "REJECTED",
      error: "EMAIL_NOT_CONFIGURED",
      retryable: true,
    }
  const timeout = providerDeadline()
  const message = await nodemailer
    .createTransport({
      streamTransport: true,
      buffer: true,
      disableFileAccess: true,
      disableUrlAccess: true,
    })
    .sendMail({ from, to, subject, text })
  const connection = new SMTPConnection({
    host,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === "true",
    requireTLS: process.env.SMTP_SECURE !== "true",
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
  })
  return new Promise<ProviderOutcome>((resolve) => {
    let settled = false
    const finish = (outcome: ProviderOutcome) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      connection.close()
      resolve(outcome)
    }
    const failure = (error: unknown) => {
      const code =
        typeof error === "object" && error && "responseCode" in error
          ? Number(error.responseCode)
          : 0
      finish(
        code >= 400 && code <= 599
          ? {
              status: "REJECTED",
              error: `EMAIL_REJECTED_${code}`,
              retryable: code < 500,
            }
          : { status: "AMBIGUOUS", error: "EMAIL_TIMEOUT_OR_CONNECTION_LOST" }
      )
    }
    const timer = setTimeout(
      () => finish({ status: "AMBIGUOUS", error: "EMAIL_DEADLINE" }),
      timeout
    )
    connection.on("error", failure)
    connection.on("end", () =>
      finish({ status: "AMBIGUOUS", error: "EMAIL_CONNECTION_CLOSED" })
    )
    connection.connect(() => {
      if (settled) return
      connection.login({ user, pass }, (error) => {
        if (error) {
          failure(error)
          return
        }
        if (settled) return
        connection.send(
          message.envelope,
          message.message,
          (sendError, info) => {
            if (sendError) {
              failure(sendError)
              return
            }
            if (info.accepted.map(String).includes(to))
              finish({ status: "ACCEPTED", messageId: message.messageId })
            else
              finish({
                status: "REJECTED",
                error: "EMAIL_RECIPIENT_REJECTED",
                retryable: false,
              })
          }
        )
      })
    })
  })
}

export async function sendRecoveryEmail(to: string, url: string) {
  const outcome = await sendEmail(
    to,
    "Reset your GhanaVerse password",
    `Use this secure link to reset your GhanaVerse password: ${url}\nThis link expires in one hour. If you did not request this, ignore this email. Never share this link.`
  )
  if (outcome.status !== "ACCEPTED")
    throw new Error("RECOVERY_EMAIL_UNAVAILABLE")
}

export async function smsDeliveryReceipt(
  messageId: string
): Promise<"DELIVERED" | "FAILED" | "ACCEPTED"> {
  const key = process.env.UELLOSEND_API_KEY
  if (!key) return "ACCEPTED"
  const response = await fetch("https://uellosend.com/delivery/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(providerDeadline()),
    body: JSON.stringify({ api_key: key, message_id: messageId }),
  })
  const body = z
    .object({
      status: z.literal("Success"),
      code: z.literal("200"),
      desc: z.array(
        z.object({ message_uuid: z.string(), delivery_status: z.string() })
      ),
    })
    .safeParse(await response.json())
  const receipt = body.success
    ? body.data.desc.find((row) => row.message_uuid === messageId)
    : undefined
  if (!response.ok || !receipt) return "ACCEPTED"
  return receipt.delivery_status === "DELIVERED"
    ? "DELIVERED"
    : ["NOT_DELIVERED", "FAILED"].includes(receipt.delivery_status)
      ? "FAILED"
      : "ACCEPTED"
}
