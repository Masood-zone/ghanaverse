"use client"
import { useState } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Heading, QueryState, Empty } from "./shared"
type Row = {
  id: string
  eventKey: string
  channel: string
  status: string
  attempts: number
  providerMessageId: string | null
  lastError: string | null
  createdAt: string
  recipient: { name: string }
}
export function NotificationsContent() {
  const [status, setStatus] = useState("AMBIGUOUS")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Row | null>(null)
  const [action, setAction] = useState("accepted")
  const [note, setNote] = useState("")
  const [providerId, setProviderId] = useState("")
  const [confirmed, setConfirmed] = useState(false)
  const client = useQueryClient()
  const query = useQuery({
    queryKey: ["admin", "notifications", status, page],
    queryFn: ({ signal }) =>
      api<{ items: Row[]; total: number }>(
        `/admin/notifications?status=${status}&page=${page}`,
        { signal }
      ),
  })
  const mutation = useMutation({
    mutationFn: () =>
      api(`/admin/notifications/${selected!.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          action,
          note,
          ...(action === "accepted"
            ? { providerMessageId: providerId }
            : action === "retry"
              ? { confirmedNotAccepted: confirmed }
              : {}),
        }),
      }),
    onSuccess: async () => {
      setSelected(null)
      await client.invalidateQueries({ queryKey: ["admin", "notifications"] })
    },
  })
  return (
    <>
      <Heading
        title="Transactional Notifications"
        eyebrow="Delivery operations"
        description="Accepted means the provider accepted the message; delivered requires a carrier receipt. Reconcile uncertain sends before retrying."
      />
      <Label className="mb-5 flex items-center gap-3 text-sm">
        Delivery state
        <select
          className="rounded border p-2"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          {[
            "AMBIGUOUS",
            "FAILED",
            "PENDING",
            "PROCESSING",
            "ACCEPTED",
            "DELIVERED",
            "CANCELLED",
          ].map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </Label>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data ? (
        <>
          <div className="overflow-x-auto">
            <table className="gv-table">
              <thead>
                <tr>
                  <th>Recipient</th>
                  <th>Event</th>
                  <th>Channel / State</th>
                  <th>Attempts</th>
                  <th>Provider / Error</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((row) => (
                  <tr key={row.id}>
                    <td>{row.recipient.name}</td>
                    <td className="max-w-56 break-all">{row.eventKey}</td>
                    <td>
                      {row.channel} / {row.status}
                    </td>
                    <td>{row.attempts}</td>
                    <td className="max-w-56 break-all">
                      {row.providerMessageId ?? row.lastError ?? "—"}
                    </td>
                    <td>
                      {["AMBIGUOUS", "FAILED", "PENDING"].includes(
                        row.status
                      ) ? (
                        <button
                          className="text-primary underline"
                          onClick={() => {
                            setSelected(row)
                            setNote("")
                            setProviderId("")
                            setConfirmed(false)
                            mutation.reset()
                          }}
                        >
                          Reconcile
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.items.length ? (
            <Empty>No notifications in this state.</Empty>
          ) : null}
          <div className="mt-4 flex gap-4">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={page * 30 >= query.data.total}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
        </>
      ) : null}
      {selected ? (
        <section className="mt-8 rounded-xl border bg-white p-5">
          <h2 className="font-bold">Reconcile notification</h2>
          <p className="mt-2 text-sm break-all">{selected.id}</p>
          <form
            className="mt-4 space-y-4"
            onSubmit={(e) => {
              e.preventDefault()
              mutation.mutate()
            }}
          >
            <Label className="gv-label">
              Outcome
              <select
                className="rounded border p-2"
                value={action}
                onChange={(e) => setAction(e.target.value)}
              >
                <option value="accepted">Provider confirms accepted</option>
                {selected.status !== "PENDING" ? (
                  <option value="retry">
                    Provider confirms not accepted; retry
                  </option>
                ) : null}
                <option value="cancel">Cancel delivery</option>
              </select>
            </Label>
            {action === "accepted" ? (
              <Label className="gv-label">
                Provider message ID
                <Input
                  required
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                />
              </Label>
            ) : action === "retry" ? (
              <Label className="flex gap-3 text-sm">
                <input
                  type="checkbox"
                  required
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                />
                I confirmed with the provider that the original message was not
                accepted.
              </Label>
            ) : null}
            <Label className="gv-label">
              Reconciliation evidence
              <Input
                required
                minLength={10}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </Label>
            {mutation.error ? (
              <p role="alert">{mutation.error.message}</p>
            ) : null}
            <div className="flex gap-3">
              <button className="gv-action" disabled={mutation.isPending}>
                Save outcome
              </button>
              <button type="button" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </form>
        </section>
      ) : null}
    </>
  )
}
