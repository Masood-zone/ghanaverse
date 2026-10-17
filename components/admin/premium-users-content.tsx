"use client"
import { useDeferredValue, useState } from "react"
import Link from "@/components/common/app-link"
import { usePremiumUsers } from "@/services/admin/premium-users"
import { Input } from "@/components/ui/input"
import { SelectField } from "@/components/ui/select-field"
import { SelectItem } from "@/components/ui/select"
import { Heading, Metric, QueryState, Pager, Empty } from "./shared"

const statusLabels = {
  ACTIVE: "Active",
  EXPIRING: "Expiring within 7 days",
  EXPIRED: "Expired",
  SUSPENDED: "Account suspended",
}

export function PremiumUsersContent() {
  const [q, setQ] = useState("")
  const [status, setStatus] = useState("all")
  const [page, setPage] = useState(1)
  const search = useDeferredValue(q)
  const query = usePremiumUsers(
    new URLSearchParams({ q: search, status, page: String(page) }).toString()
  )
  const data = query.isError ? undefined : query.data
  return (
    <>
      <Heading
        eyebrow="Premium access"
        title="Premium Users"
        description="Track current passes and expired access. Refunded or revoked access is excluded."
        actions={
          <Link className="gv-action secondary" href="/admin/analytics">
            View payments & analytics
          </Link>
        }
      />
      {data ? (
        <>
          <p className="mb-4 text-sm font-semibold text-primary">
            {data.mode
              ? `${data.mode === "test" ? "Test" : "Live"} payment environment`
              : "Payments are not configured"}
          </p>
          <div className="mb-6 grid gap-4 sm:grid-cols-3">
            <Metric
              label="Active Premium users"
              value={data.active}
              icon="workspace_premium"
            />
            <Metric
              label="Expiring within 7 days"
              value={data.expiring}
              icon="schedule"
            />
            <Metric
              label="Expired Premium users"
              value={data.expired}
              icon="history"
            />
          </div>
        </>
      ) : null}
      <div className="gv-panel mb-5 flex flex-wrap items-center gap-3">
        <Input
          className="min-w-48 flex-1"
          aria-label="Search Premium users"
          placeholder="Search name or email…"
          value={q}
          onChange={(event) => {
            setQ(event.target.value)
            setPage(1)
          }}
        />
        <SelectField
          aria-label="Filter Premium status"
          value={status}
          onValueChange={(value) => {
            setStatus(value)
            setPage(1)
          }}
        >
          <SelectItem value="all">All Premium history</SelectItem>
          <SelectItem value="active">Active</SelectItem>
          <SelectItem value="expiring">Expiring within 7 days</SelectItem>
          <SelectItem value="expired">Expired</SelectItem>
          <SelectItem value="suspended">Account suspended</SelectItem>
        </SelectField>
        <button
          className="gv-action secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {data ? (
        <section className="overflow-hidden rounded-xl border bg-white">
          <div className="overflow-x-auto">
            <table className="gv-table min-w-[660px]">
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Email</th>
                  <th>Premium status</th>
                  <th>Pass expires (UTC)</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => (
                  <tr key={user.id}>
                    <td className="font-semibold">{user.name}</td>
                    <td>{user.email}</td>
                    <td>
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${user.status === "ACTIVE" ? "bg-green-100 text-green-800" : user.status === "EXPIRING" ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700"}`}
                      >
                        {statusLabels[user.status]}
                      </span>
                    </td>
                    <td>
                      {new Date(user.expiresAt).toLocaleString(undefined, {
                        timeZone: "UTC",
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.items.length ? (
            <Empty>
              {data.mode
                ? "No Premium users match these filters."
                : "Configure payments to select a billing environment."}
            </Empty>
          ) : null}
          <Pager {...data} onPage={setPage} />
        </section>
      ) : null}
    </>
  )
}
