"use client"
import Link from "@/components/common/app-link"
import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { billingDate, money } from "@/lib/billing-format"
import { QueryState } from "@/components/common/query-state"
type Receipt = {
  reference: string
  amount: number
  days: number
  status: string
  channel: string
  paidAt: string | null
  createdAt: string
  refundAmount: number
  user: { name: string; email: string }
}
export function ReceiptContent({ reference }: { reference: string }) {
  const query = useQuery({
    queryKey: ["billing", "receipt", reference],
    queryFn: ({ signal }) =>
      api<Receipt>(`/billing/receipt/${encodeURIComponent(reference)}`, {
        signal,
      }),
  })
  if (!query.data)
    return (
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
    )
  const r = query.data
  return (
    <article className="gv-sub-card gv-sub-receipt">
      <p className="text-xs font-bold text-primary">
        GHANAVERSE · PAYMENT RECORD
      </p>
      <h1 className="mt-3 text-3xl font-bold">Premium Pass Receipt</h1>
      <dl className="mt-6">
        {[
          ["Reference", r.reference],
          ["Account", r.user.name],
          ["Email", r.user.email],
          ["Amount", money(r.amount)],
          ["Access purchased", `${r.days} days`],
          ["Method", r.channel.replaceAll("_", " ")],
          ["Status", r.status],
          ["Paid", billingDate(r.paidAt)],
          ["Refunded", money(r.refundAmount)],
        ].map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd className="text-right font-medium break-all">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-5 text-xs text-slate-500">
        This records the payment status shown above. Access is granted only for
        verified successful payments. This is not a tax invoice.
      </p>
      <div className="gv-no-print mt-6 flex gap-3">
        <button className="gv-sub-button" onClick={() => window.print()}>
          Print / Save PDF
        </button>
        <Link href="/account" className="gv-sub-button gv-sub-button-outline">
          Back to account
        </Link>
      </div>
    </article>
  )
}
