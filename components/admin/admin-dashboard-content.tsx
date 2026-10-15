"use client"
import { useAdminDashboard } from "@/services/admin/dashboard"
import Link from "next/link"
import { Heading, Metric, QueryState, Empty, Status } from "./shared"
export function AdminDashboardContent() {
  const query = useAdminDashboard()
  const data = query.data
  return (
    <>
      <Heading
        eyebrow="GhanaVerse Intelligence"
        title="Dashboard Overview"
        description="Catalogue health, viewer adoption, and recent administrative activity."
        actions={
          <Link className="gv-action" href="/admin/content/new">
            ＋ Add Content
          </Link>
        }
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              ["Total titles", data.titles, "movie"],
              ["Published titles", data.published, "verified"],
              ["In draft", data.drafts, "edit_document"],
              ["Unpublished", data.unpublished, "visibility_off"],
              ["Registered viewers", data.viewers, "group"],
              ["Creators", data.creators, "groups"],
            ].map(([label, value, icon]) => (
              <Metric
                key={String(label)}
                label={String(label)}
                value={Number(value)}
                icon={String(icon)}
              />
            ))}
          </div>
          <div className="mt-7 grid gap-6 xl:grid-cols-[1.5fr_1fr]">
            <section className="gv-panel">
              <h2 className="text-xl font-bold">Catalogue by Content Format</h2>
              <p className="mt-2 text-xs text-muted-foreground">
                Published and private titles in the current catalogue.
              </p>
              <div className="mt-7 space-y-6">
                {data.distribution.length ? (
                  data.distribution.map((item) => (
                    <div key={item.contentType}>
                      <div className="flex justify-between text-xs">
                        <span>{item.contentType.replaceAll("_", " ")}</span>
                        <strong>{item._count}</strong>
                      </div>
                      <div className="mt-2 h-3 overflow-hidden rounded bg-white">
                        <div
                          className="h-full rounded bg-[#8d4b00]"
                          style={{
                            width: `${data.titles ? (item._count / data.titles) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <Empty>
                    Add your first title to see catalogue distribution.
                  </Empty>
                )}
              </div>
            </section>
            <section className="gv-panel">
              <h2 className="text-xl font-bold">Publication Workflow</h2>
              <p className="mt-2 text-xs leading-6 text-slate-600">
                Prepare metadata, credit the creators, and add artwork before
                publishing. Movie playback can be connected later.
              </p>
              <div className="mt-6 grid gap-3">
                <Link className="gv-action secondary" href="/admin/creators">
                  Manage creators
                </Link>
                <Link className="gv-action secondary" href="/admin/metadata">
                  Maintain metadata & rights
                </Link>
                <Link className="gv-action" href="/admin/content/new">
                  Prepare a title
                </Link>
              </div>
            </section>
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[.8fr_1.2fr]">
            <section className="gv-panel">
              <div className="flex justify-between">
                <h2 className="text-xl font-bold">Recent Activity</h2>
                <Link className="text-xs text-primary" href="/admin/activity">
                  View all
                </Link>
              </div>
              <div className="mt-5 space-y-3">
                {data.activity.length ? (
                  data.activity.map((item) => (
                    <div key={item.id} className="rounded-lg bg-white p-3">
                      <p className="text-xs font-semibold">
                        {item.action.replaceAll("_", " ")}
                      </p>
                      <p className="mt-1 text-[10px] text-muted-foreground">
                        {new Date(item.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                ) : (
                  <Empty>No administrator activity recorded yet.</Empty>
                )}
              </div>
            </section>
            <section className="gv-panel">
              <div className="flex justify-between">
                <h2 className="text-xl font-bold">Recently Added Content</h2>
                <Link className="text-xs text-primary" href="/admin/content">
                  View all
                </Link>
              </div>
              <div className="mt-5 overflow-x-auto rounded-lg">
                <table className="gv-table">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recent.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link
                            className="font-semibold text-primary"
                            href={`/admin/content/${item.id}`}
                          >
                            {item.title}
                          </Link>
                        </td>
                        <td>{item.contentType.replaceAll("_", " ")}</td>
                        <td>
                          <Status value={item.publicationStatus} />
                        </td>
                        <td>{new Date(item.createdAt).toLocaleDateString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {!data.recent.length ? (
                  <Empty>No titles yet. Start with Add Content.</Empty>
                ) : null}
              </div>
            </section>
          </div>
        </>
      ) : null}
    </>
  )
}
