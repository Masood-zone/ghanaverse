"use client"
import { useAdminDashboard } from "@/services/admin/dashboard"
import { useAdminOptions } from "@/services/admin/metadata"
import { useAdminContent } from "@/services/admin/content"
import { useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { ContentArtwork } from "@/components/catalogue/content-artwork"
import { useAdminMutation } from "@/services/admin/queries"
import { Heading, Metric, QueryState, Pager, Status, Empty } from "./shared"
export function ContentLibraryContent() {
  const [q, setQ] = useState("")
  const [type, setType] = useState("")
  const [status, setStatus] = useState("")
  const [genre, setGenre] = useState("")
  const [page, setPage] = useState(1)
  const query = useAdminContent(
    `${new URLSearchParams({ q, type, status, genre, page: String(page) })}`
  )
  const options = useAdminOptions()
  const dashboard = useAdminDashboard()
  const mutation = useAdminMutation()
  function update(id: string, publicationStatus: string) {
    mutation.mutate(
      {
        path: `content/${id}/publication`,
        method: "PATCH",
        body: {
          status:
            publicationStatus === "PUBLISHED" ? "UNPUBLISHED" : "PUBLISHED",
        },
      },
      {
        onSuccess: () => toast.success("Publication updated"),
        onError: (e) => toast.error(e.message),
      }
    )
  }
  return (
    <>
      <Heading
        eyebrow="Catalogue master control · Admin suite"
        title="Content Library"
        description="Manage, review, publish, and organise all streaming titles in the GhanaVerse catalogue."
        actions={
          <Link className="gv-action" href="/admin/content/new">
            ＋ Add Content
          </Link>
        }
      />
      {dashboard.data ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Active titles", dashboard.data.titles, "movie"],
            ["Published live", dashboard.data.published, "verified"],
            ["In draft", dashboard.data.drafts, "edit_document"],
            ["Unpublished", dashboard.data.unpublished, "inventory_2"],
          ].map(([label, value, icon]) => (
            <Metric
              key={String(label)}
              label={String(label)}
              value={Number(value)}
              icon={String(icon)}
            />
          ))}
        </div>
      ) : null}
      <div className="gv-panel mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <input
          aria-label="Search titles"
          placeholder="Search titles…"
          className="gv-field"
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(1)
          }}
        />
        <select
          aria-label="Content type"
          className="gv-field"
          value={type}
          onChange={(e) => {
            setType(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All types</option>
          {[
            "MOVIE",
            "SERIES",
            "DOCUMENTARY",
            "CULTURAL_PROGRAMME",
            "LIFESTYLE_PROGRAMME",
          ].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Publication status"
          className="gv-field"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All statuses</option>
          {["DRAFT", "PUBLISHED", "UNPUBLISHED"].map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
        <select
          aria-label="Genre"
          className="gv-field"
          value={genre}
          onChange={(e) => {
            setGenre(e.target.value)
            setPage(1)
          }}
        >
          <option value="">All genres</option>
          {options.data?.genres.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </div>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {query.data ? (
        <div className="overflow-hidden rounded-xl shadow-sm">
          <div className="overflow-x-auto">
            <table className="gv-table min-w-[850px]">
              <thead>
                <tr>
                  {[
                    "Poster & Title",
                    "Type",
                    "Classification",
                    "Rights Holder",
                    "Status",
                    "Actions",
                  ].map((t) => (
                    <th key={t}>{t}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {query.data.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        href={`/admin/content/${item.id}`}
                        className="flex items-center gap-3"
                      >
                        <span className="relative h-16 w-11 shrink-0 overflow-hidden rounded">
                          <ContentArtwork src={item.posterUrl} alt="" />
                        </span>
                        <span>
                          <strong className="block text-primary">
                            {item.title}
                          </strong>
                          <small>{item.releaseYear ?? "Year not set"}</small>
                        </span>
                      </Link>
                    </td>
                    <td>{item.contentType.replaceAll("_", " ")}</td>
                    <td>{item.classification ?? "Unassigned"}</td>
                    <td>{item.rightsHolder?.name ?? "Unassigned"}</td>
                    <td>
                      <Status value={item.publicationStatus} />
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-2">
                        <Link
                          className="text-xs font-semibold text-primary"
                          href={`/admin/content/${item.id}`}
                        >
                          Open
                        </Link>
                        <button
                          className="text-xs font-semibold text-primary"
                          disabled={mutation.isPending}
                          onClick={() => {
                            if (
                              confirm(
                                `${item.publicationStatus === "PUBLISHED" ? "Unpublish" : "Publish"} ${item.title}?`
                              )
                            )
                              update(item.id, item.publicationStatus)
                          }}
                        >
                          {item.publicationStatus === "PUBLISHED"
                            ? "Unpublish"
                            : "Publish"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!query.data.items.length ? (
            <Empty>No titles match these filters.</Empty>
          ) : null}
          <Pager {...query.data} onPage={setPage} />
        </div>
      ) : null}
    </>
  )
}
