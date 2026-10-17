"use client"
import { SelectField } from "@/components/ui/select-field"
import { SelectItem } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useState } from "react"
import { useAnalytics } from "@/services/analytics/queries"
import { Heading, QueryState, Empty, Pager } from "@/components/admin/shared"
import type { AnalyticsReport } from "@/types/analytics"
const hours = (seconds: number) =>
  seconds > 0 && seconds < 36
    ? "<0.01"
    : (seconds / 3600).toLocaleString(undefined, { maximumFractionDigits: 2 })
export function AnalyticsContent({
  audience,
}: {
  audience: "admin" | "creator"
}) {
  const [range, setRange] = useState("30"),
    [contentId, setContentId] = useState(""),
    [page, setPage] = useState(1)
  const params = new URLSearchParams({
    range,
    ...(contentId ? { contentId } : {}),
  }).toString()
  const query = useAnalytics(audience, params),
    report = query.isError ? undefined : query.data
  const maxHours = Math.max(
    1,
    ...(report?.daily.map((day) => day.watchSeconds) ?? [])
  )
  return (
    <section className={audience === "creator" ? "gv-container py-10" : ""}>
      <Heading
        eyebrow="GhanaVerse viewing analytics"
        title={
          audience === "admin" ? "Platform Analytics" : "Rights-holder reports"
        }
        description={
          audience === "admin"
            ? "Understand viewing activity across the catalogue."
            : "Viewing activity for titles assigned to your rights-holder organizations."
        }
        actions={
          report ? (
            <a
              className="gv-action"
              href={`/api/${audience}/analytics?${params}&format=csv`}
            >
              Export CSV report
            </a>
          ) : undefined
        }
      />
      <div className="gv-panel mb-6 flex flex-wrap items-end gap-4">
        <Label className="gv-label">
          Reporting period
          <SelectField
            aria-label="Reporting period"
            value={range}
            onValueChange={(event) => {
              setRange(event)
              setPage(1)
            }}
          >
            <SelectItem value="7">Last 7 days</SelectItem>
            <SelectItem value="30">Last 30 days</SelectItem>
            <SelectItem value="90">Last 90 days</SelectItem>
            <SelectItem value="all">All time</SelectItem>
          </SelectField>
        </Label>
        <Label className="gv-label min-w-56 flex-1">
          Title
          <SelectField
            aria-label="Title"
            value={contentId}
            onValueChange={(event) => {
              setContentId(event)
              setPage(1)
            }}
          >
            <SelectItem value="">All available titles</SelectItem>
            {report?.titles.map((title) => (
              <SelectItem key={title.id} value={title.id}>
                {title.title}
              </SelectItem>
            ))}
          </SelectField>
        </Label>
        <button
          className="gv-action secondary"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          {query.isFetching ? "Refreshing…" : "Refresh"}
        </button>
      </div>
      <p className="mb-6 text-xs leading-6 text-muted-foreground">
        Streams count immediately on the first playback start per viewing
        session. Pausing and resuming do not add streams. Dates use UTC. These
        are GhanaVerse measurements, not official YouTube view counts, watch
        totals, or earnings.
      </p>
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
      {report ? (
        <>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <Stat
              label="Streams"
              value={report.summary.streams.toLocaleString()}
            />
            <Stat
              label="Distinct viewer accounts"
              value={report.summary.viewers.toLocaleString()}
            />
            <Stat
              label="Watch hours"
              value={hours(report.summary.watchSeconds)}
            />
            <Stat
              label="Average viewing minutes"
              value={(report.summary.averageSeconds / 60).toFixed(1)}
            />
            <Stat
              label="Completion rate"
              value={`${report.summary.completionRate.toFixed(1)}%`}
            />
          </div>
          <section className="gv-panel mb-6">
            <h2 className="text-xl font-bold">Daily viewing</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Watch hours recorded each day, with immediate stream starts.
            </p>
            {report.daily.length ? (
              <div className="mt-5 max-h-80 space-y-3 overflow-y-auto pr-2">
                {report.daily.map((day) => (
                  <div
                    key={day.day}
                    className="grid grid-cols-[90px_1fr_130px] items-center gap-3 text-xs"
                  >
                    <span>{day.day}</span>
                    <div className="h-5 overflow-hidden rounded bg-[#e6eeff]">
                      <div
                        className="h-full rounded bg-primary"
                        style={{
                          width: `${(day.watchSeconds / maxHours) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-right">
                      {hours(day.watchSeconds)} h · {day.streams} streams
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <Empty>
                Streams and watch time will appear here when viewers start your
                available videos.
              </Empty>
            )}
          </section>
          <section className="gv-panel mb-6">
            <h2 className="mb-4 text-xl font-bold">Title performance</h2>
            <PerformanceTable
              rows={report.rows.slice((page - 1) * 20, page * 20)}
            />
            <Pager
              page={page}
              totalPages={Math.max(1, Math.ceil(report.rows.length / 20))}
              total={report.rows.length}
              onPage={setPage}
            />
          </section>
          {report.episodes.length ? (
            <section className="gv-panel">
              <h2 className="mb-4 text-xl font-bold">Episode performance</h2>
              <PerformanceTable rows={report.episodes} />
            </section>
          ) : null}
          <p className="mt-5 text-xs leading-6 text-muted-foreground">
            Completion means at least 90% of a video’s unique timeline was
            watched within a viewing session. Watch time excludes paused,
            buffering, and hidden-page time. Counts begin when tracking is
            enabled; saved resume positions are not historical viewing totals.
          </p>
        </>
      ) : null}
    </section>
  )
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#eff3ff] p-5">
      <p className="text-[10px] font-semibold tracking-wider text-slate-600 uppercase">
        {label}
      </p>
      <p className="mt-4 text-3xl font-extrabold">{value}</p>
    </div>
  )
}
function PerformanceTable({ rows }: { rows: AnalyticsReport["rows"] }) {
  if (!rows.length)
    return (
      <Empty>
        Assign content to this rights holder to include it in reports.
      </Empty>
    )
  return (
    <div className="overflow-x-auto">
      <table className="gv-table min-w-[760px]">
        <thead>
          <tr>
            {[
              "Title",
              "Format",
              "Streams",
              "Viewers",
              "Watch hours",
              "Avg. minutes",
              "Completion",
            ].map((label) => (
              <th key={label}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="font-semibold">{row.title}</td>
              <td>{row.contentType.replaceAll("_", " ")}</td>
              <td>{row.streams.toLocaleString()}</td>
              <td>{row.viewers.toLocaleString()}</td>
              <td>{hours(row.watchSeconds)}</td>
              <td>{(row.averageSeconds / 60).toFixed(1)}</td>
              <td>{row.completionRate.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
