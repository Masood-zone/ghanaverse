"use client"
import Link from "next/link"
import { useState } from "react"
import { useAdminContent } from "@/services/admin/content"
import { ContentScope } from "./content-scope"
import { QueryState, Status, Pager, Empty } from "./shared"
function Library() {
  const [q, setQ] = useState(""),
    [page, setPage] = useState(1)
  const query = useAdminContent(
    new URLSearchParams({ q, page: String(page) }).toString()
  )
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold">Your content</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create, upload, preview, and publish titles belonging to your linked
            organizations.
          </p>
        </div>
        <Link className="gv-action" href="/creator/content/new">
          Add content
        </Link>
      </div>
      <label className="gv-label mb-5 max-w-md">
        Search your titles
        <input
          className="gv-field"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
      </label>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data ? (
        <div className="gv-panel divide-y">
          {query.data.items.length ? (
            query.data.items.map((item) => (
              <Link
                href={`/creator/content/${item.id}`}
                className="flex flex-wrap items-center justify-between gap-4 py-5"
                key={item.id}
              >
                <div>
                  <p className="text-lg font-bold">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    {item.contentType.replaceAll("_", " ")} ·{" "}
                    {item.rightsHolder?.name}
                  </p>
                </div>
                <Status value={item.publicationStatus} />
              </Link>
            ))
          ) : (
            <Empty>
              No titles found. Create a title to begin. An administrator must
              link your account to a rights-holder organization first.
            </Empty>
          )}
          <Pager
            page={query.data.page}
            totalPages={query.data.totalPages}
            total={query.data.total}
            onPage={setPage}
          />
        </div>
      ) : null}
    </>
  )
}
export function CreatorLibrary() {
  return (
    <ContentScope value="creator">
      <Library />
    </ContentScope>
  )
}
