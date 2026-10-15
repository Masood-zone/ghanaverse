"use client"
import { useAdminActivity } from "@/services/admin/activity"
import { useState } from "react"
import { Heading, QueryState, Pager, Empty } from "./shared"
export function ActivityContent() {
  const [q, setQ] = useState("")
  const [page, setPage] = useState(1)
  const query = useAdminActivity(
    `${new URLSearchParams({ q, page: String(page) })}`
  )
  return (
    <>
      <Heading
        eyebrow="Administrative accountability"
        title="Activity History"
        description="Persisted records of successful administrator changes. History is read-only."
      />
      <input
        aria-label="Search activity"
        className="gv-field mb-5 max-w-md"
        placeholder="Search actions or record IDs…"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setPage(1)
        }}
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data ? (
        <div className="overflow-hidden rounded-xl">
          <div className="overflow-x-auto">
            <table className="gv-table">
              <thead>
                <tr>
                  <th>Administrator</th>
                  <th>Action</th>
                  <th>Record</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.actorName}</td>
                    <td>{item.action.replaceAll("_", " ")}</td>
                    <td className="font-mono text-[10px]">
                      {item.entityType} · {item.entityId}
                    </td>
                    <td>{new Date(item.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.items.length ? (
            <Empty>No recorded changes match this search.</Empty>
          ) : null}
          <Pager {...query.data} onPage={setPage} />
        </div>
      ) : null}
    </>
  )
}
