"use client"
import Link from "@/components/common/app-link"
import { Empty, Pager } from "@/components/admin/shared"
import { money } from "@/lib/billing-format"
import type { AnalyticsReport } from "@/types/analytics"

export function PaymentAnalytics({
  data,
  onPage,
}: {
  data: NonNullable<AnalyticsReport["payments"]>
  onPage: (page: number) => void
}) {
  const maximum = Math.max(1, ...data.daily.map((day) => day.amount))
  return (
    <section
      aria-label="Viewer payment analytics"
      className="mb-8 space-y-5 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 md:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-primary uppercase">
            Premium Pass payments
          </p>
          <h2 className="mt-1 text-2xl font-extrabold">Viewer payments</h2>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="rounded-full border bg-white px-3 py-1 text-xs font-bold">
            {data.mode === "test"
              ? "Test payments"
              : data.mode === "live"
                ? "Live payments"
                : "Payments not configured"}
          </span>
          <Link
            href="/admin/premium-users"
            className="text-sm font-bold text-primary"
          >
            Premium users →
          </Link>
        </div>
      </div>
      <p className="max-w-4xl text-xs leading-6 text-slate-600">
        Platform-wide GHS totals use the confirmation date in UTC. Gross
        includes confirmed payments later refunded or charged back, before any
        fees or reversals. Test and live payments are kept separate. The title
        filter applies to viewing activity only.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs font-bold text-slate-600 uppercase">
            Gross confirmed payments
          </p>
          <p className="mt-3 text-3xl font-extrabold break-words">
            {money(data.grossAmount)}
          </p>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <p className="text-xs font-bold text-slate-600 uppercase">
            Confirmed payments
          </p>
          <p className="mt-3 text-3xl font-extrabold">
            {data.paidCount.toLocaleString()}
          </p>
        </div>
      </div>
      <section className="rounded-xl border bg-white p-4 md:p-5">
        <h3 className="text-lg font-bold">Daily gross payments</h3>
        {data.daily.length ? (
          <div className="mt-4 max-h-80 space-y-3 overflow-y-auto pr-2">
            {data.daily.map((day) => (
              <div
                key={day.day}
                className="grid grid-cols-[90px_1fr] items-center gap-2 text-xs sm:grid-cols-[90px_1fr_180px]"
              >
                <span>{day.day}</span>
                <div className="h-5 overflow-hidden rounded bg-amber-50">
                  <div
                    aria-hidden="true"
                    className="h-full rounded bg-amber-500"
                    style={{ width: `${(day.amount / maximum) * 100}%` }}
                  />
                </div>
                <span className="col-span-2 text-right sm:col-span-1">
                  {money(day.amount)} · {day.count} payment
                  {day.count === 1 ? "" : "s"}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <Empty>No confirmed payments in this reporting period.</Empty>
        )}
      </section>
      <section className="overflow-hidden rounded-xl border bg-white">
        <div className="p-4 md:p-5">
          <h3 className="text-lg font-bold">Payment transactions</h3>
          <p className="mt-1 text-xs text-slate-600">
            All attempts created in the selected period, including pending and
            unsuccessful payments. Dates use UTC.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="gv-table min-w-[940px]">
            <thead>
              <tr>
                <th>User</th>
                <th>Created (UTC)</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <span className="font-semibold">{payment.user.name}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {payment.user.email}
                    </span>
                  </td>
                  <td>
                    {new Date(payment.createdAt).toLocaleString(undefined, {
                      timeZone: "UTC",
                    })}
                  </td>
                  <td className="font-bold whitespace-nowrap">
                    {money(payment.amount)}
                  </td>
                  <td>
                    {payment.channel.replaceAll("_", " ")}
                    {payment.mobileMoneyNetwork
                      ? ` · ${payment.mobileMoneyNetwork.toUpperCase()}`
                      : ""}
                  </td>
                  <td className="max-w-60 font-mono text-xs break-all">
                    {payment.reference}
                  </td>
                  <td>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-bold whitespace-nowrap ${payment.status === "SUCCESS" ? "bg-green-100 text-green-800" : payment.status === "PENDING" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}
                    >
                      {payment.status.replaceAll("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!data.items.length ? (
          <Empty>No payment attempts in this reporting period.</Empty>
        ) : null}
        <Pager {...data} onPage={onPage} />
      </section>
      <Link
        href="/admin/royalties"
        className="inline-block text-sm font-bold text-primary"
      >
        Open licensing, payouts & payment review →
      </Link>
    </section>
  )
}
