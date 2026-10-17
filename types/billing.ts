import type { billingSummary } from "@/services/billing/payments"
import type { reconcilePayment } from "@/services/billing/payments"
import type { earnings } from "@/services/billing/licensing"
type Serialized<T> = T extends Date
  ? string
  : T extends Array<infer U>
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T
export type BillingSummary = Serialized<
  Awaited<ReturnType<typeof billingSummary>>
>
export type PaymentVerification = Serialized<
  Awaited<ReturnType<typeof reconcilePayment>>
>
export type EarningsData = Serialized<Awaited<ReturnType<typeof earnings>>>
export type AdminBillingData = EarningsData & {
  plan: BillingSummary["plan"]
  billing: BillingSummary
  payments: {
    id: string
    reference: string
    amount: number
    status: string
    fee: number | null
    refundAmount: number
    reviewRequired: boolean
    createdAt: string
    user: { name: string }
  }[]
}
