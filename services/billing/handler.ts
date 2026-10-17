import "server-only"
import { z } from "zod"
import { requireUser } from "@/lib/auth/access"
import { apiSuccess } from "@/lib/api-response"
import { PlatformError, routeError } from "@/lib/route-error"
import { assertRequestOrigin } from "@/services/content/access"
import { getPrisma } from "@/lib/prisma"
import { paymentMode } from "@/lib/paystack"
import { planSchema } from "@/lib/validation/billing"
import {
  billingActor,
  billingSummary,
  initializeCheckout,
  reconcilePayment,
  ensurePlan,
  audit,
} from "./payments"
import {
  earnings,
  createLicense,
  licenseStatus,
  createRecipient,
  approveRecipient,
  payoutBanks,
  approvePayout,
  sendPayout,
  reconcilePayout,
  holderScope,
} from "./licensing"

function statementCsv(rows: Awaited<ReturnType<typeof earnings>>["licenses"]) {
  const cell = (value: unknown) => {
    let text = String(value ?? "")
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text
    return `"${text.replaceAll('"', '""')}"`
  }
  return [
    [
      "Agreement",
      "Rights holder",
      "Title",
      "Currency",
      "Fixed fee",
      "Due UTC",
      "Licence status",
      "Payout reference",
      "Payout status",
    ],
    ...rows.flatMap((r) =>
      (r.payouts.length ? r.payouts : [null]).map((p) => [
        r.id,
        r.rightsHolder.name,
        r.content.title,
        "GHS",
        (r.amount / 100).toFixed(2),
        r.dueAt.toISOString(),
        r.status,
        p?.reference,
        p?.status ?? "UNPAID",
      ])
    ),
  ]
    .map((row) => row.map(cell).join(","))
    .join("\r\n")
}
export async function handleBilling(request: Request) {
  try {
    const url = new URL(request.url),
      parts = url.pathname.split("/").filter(Boolean)
    const admin = parts[1] === "admin",
      creator = parts[1] === "creator"
    const path = parts.slice(admin || creator ? 3 : 2)
    const mutation = request.method !== "GET"
    if (mutation) assertRequestOrigin(request)
    // Public plan information exposes no payments or entitlement for other users.
    if (
      !admin &&
      !creator &&
      request.method === "GET" &&
      path.length === 1 &&
      path[0] === "plans"
    )
      return privateResponse(await billingSummary())
    const { user } = await requireUser()
    await billingActor(user.id, admin)
    if (creator) await holderScope(user.id)
    const body: unknown = mutation ? await request.json() : null
    let result: unknown
    if (admin || creator) {
      if (request.method === "GET" && path[0] === "banks") {
        result = await payoutBanks(
          z.enum(["ghipss", "mobile_money"]).parse(url.searchParams.get("type"))
        )
      } else if (request.method === "GET" && !path.length) {
        const data = await earnings(
          user.id,
          url.searchParams.get("format") === "csv"
        )
        if (url.searchParams.get("format") === "csv")
          return new Response(statementCsv(data.licenses), {
            headers: {
              "Content-Type": "text/csv; charset=utf-8",
              "Content-Disposition":
                'attachment; filename="ghanaverse-licensing-statement.csv"',
              "Cache-Control": "private, no-store",
            },
          })
        result = admin
          ? {
              ...data,
              plan: await ensurePlan(),
              billing: await billingSummary(),
              payments: await getPrisma().billingPayment.findMany({
                where: { mode: paymentMode() },
                orderBy: { createdAt: "desc" },
                take: 100,
                select: {
                  id: true,
                  reference: true,
                  amount: true,
                  status: true,
                  fee: true,
                  refundAmount: true,
                  reviewRequired: true,
                  createdAt: true,
                  user: { select: { name: true } },
                },
              }),
            }
          : data
      } else if (admin && request.method === "PATCH" && path[0] === "plan") {
        const input = planSchema.parse(body)
        result = await getPrisma().$transaction(async (tx) => {
          await billingActor(user.id, true, tx)
          const plan = await tx.billingPlan.upsert({
            where: { id: "premium" },
            create: { id: "premium", ...input },
            update: input,
          })
          await audit(tx, user.id, "UPDATE_BILLING_PLAN", "plans", plan.id)
          return { id: plan.id }
        })
      } else if (admin && request.method === "POST" && path[0] === "licenses")
        result = await createLicense(user.id, body)
      else if (
        admin &&
        request.method === "PATCH" &&
        path[0] === "licenses" &&
        path[1]
      )
        result = await licenseStatus(user.id, path[1], body)
      else if (request.method === "POST" && path[0] === "recipients")
        result = await createRecipient(user.id, body)
      else if (
        admin &&
        request.method === "PATCH" &&
        path[0] === "recipients" &&
        path[1]
      )
        result = await approveRecipient(user.id, path[1])
      else if (
        admin &&
        request.method === "POST" &&
        path[0] === "payouts" &&
        !path[1]
      )
        result = await approvePayout(user.id, body)
      else if (
        admin &&
        request.method === "POST" &&
        path[0] === "payouts" &&
        path[1]
      ) {
        const input = z
          .object({
            action: z.enum(["send", "finalize", "reconcile", "retry"]),
            otp: z
              .string()
              .regex(/^\d{4,10}$/)
              .optional(),
          })
          .strict()
          .parse(body)
        if (input.action === "finalize" && !input.otp)
          throw new PlatformError(
            400,
            "OTP_REQUIRED",
            "Enter the provider's one-time code."
          )
        result =
          input.action === "reconcile"
            ? await reconcilePayout(path[1])
            : await sendPayout(
                user.id,
                path[1],
                input.action === "finalize" ? input.otp : undefined,
                input.action === "retry"
              )
      } else if (
        admin &&
        request.method === "POST" &&
        path[0] === "reviews" &&
        path[1]
      ) {
        const input = z
          .object({ refundAmount: z.number().int().nonnegative() })
          .strict()
          .parse(body)
        result = await getPrisma().$transaction(async (tx) => {
          await billingActor(user.id, true, tx)
          const payment = await tx.billingPayment.findUnique({
            where: { id: path[1] },
          })
          if (!payment || payment.mode !== paymentMode())
            throw new PlatformError(
              404,
              "PAYMENT_NOT_FOUND",
              "Payment was not found."
            )
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(hashtext(${`billing:${payment.userId}:${payment.mode}`}))`
          const current = await tx.billingPayment.findUniqueOrThrow({
            where: { id: payment.id },
          })
          if (current.refundAmount !== input.refundAmount)
            throw new PlatformError(
              409,
              "ADJUSTMENT_CHANGED",
              "The adjustment changed. Review the refreshed record first."
            )
          await tx.billingPayment.update({
            where: { id: payment.id },
            data: { reviewRequired: false },
          })
          await audit(
            tx,
            user.id,
            "REVIEW_PAYMENT_ADJUSTMENT",
            "payments",
            payment.id
          )
          return { id: payment.id }
        })
      } else if (
        admin &&
        request.method === "POST" &&
        path[0] === "reconcile"
      ) {
        result = await reconcilePayment(
          z
            .object({ reference: z.string().min(1).max(100) })
            .strict()
            .parse(body).reference
        )
      } else
        throw new PlatformError(
          405,
          "METHOD_NOT_ALLOWED",
          "Unsupported billing operation."
        )
    } else if (request.method === "POST" && path[0] === "checkout")
      result = await initializeCheckout(user.id, body)
    else if (request.method === "POST" && path[0] === "verify")
      result = await reconcilePayment(
        z
          .object({ reference: z.string().min(1).max(100) })
          .strict()
          .parse(body).reference,
        user.id
      )
    else if (request.method === "GET" && path[0] === "receipt" && path[1]) {
      result = await getPrisma().billingPayment.findFirst({
        where: { reference: path[1], userId: user.id, mode: paymentMode() },
        select: {
          reference: true,
          amount: true,
          currency: true,
          days: true,
          status: true,
          channel: true,
          paidAt: true,
          createdAt: true,
          refundAmount: true,
          user: { select: { name: true, email: true } },
        },
      })
      if (!result)
        throw new PlatformError(
          404,
          "PAYMENT_NOT_FOUND",
          "Receipt was not found."
        )
    } else if (request.method === "GET" && !path.length)
      result = await billingSummary(user.id)
    else
      throw new PlatformError(
        405,
        "METHOD_NOT_ALLOWED",
        "Unsupported billing operation."
      )
    return privateResponse(result)
  } catch (error) {
    const response = routeError(
      error,
      "The billing request could not be completed."
    )
    response.headers.set("Cache-Control", "private, no-store")
    return response
  }
}
function privateResponse(data: unknown) {
  const response = apiSuccess(data)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}
