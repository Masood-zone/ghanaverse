"use client"
import { useState } from "react"
import { useAdminResource } from "@/services/admin/queries"
import { videoRequest } from "@/lib/video/client-api"
import { formatBytes } from "@/lib/video/constants"
import { Heading, QueryState } from "./shared"
type StorageData = {
  configuration: { configured: boolean; missing: string[] }
  usage: {
    stored: number
    reserved: number
    pendingCleanup: number
    available: number
    budget: number
  }
  sessions: {
    id: string
    destination: string
    filename: string
    status: string
    fileSize: number
    expiresAt: string
    lastError: string | null
  }[]
  objects: {
    id: string
    bytes: number
    state: string
    lastError: string | null
    asset: { id: string } | null
  }[]
}
type StorageActionResult =
  | {
      kind: "diagnostics"
      checks: { label: string; passed: boolean }[]
      browserCors: string
    }
  | {
      kind: "cleanup"
      expired: number
      cancelled: number
      attempted: number
      deleted: number
    }

export function StorageContent() {
  const query = useAdminResource<StorageData>("storage")
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState<StorageActionResult | string>("")
  async function action(path: "diagnostics" | "cleanup") {
    setBusy(true)
    setMessage("")
    try {
      const result = await videoRequest<Record<string, unknown>>(
        `admin/storage/${path}`,
        "POST",
        {}
      )
      if (path === "diagnostics") {
        setMessage({
          kind: "diagnostics",
          checks: [
            { label: "Save a test file", passed: result.write === true },
            { label: "Read the test file", passed: result.read === true },
            { label: "Stream part of the file", passed: result.rangeRead === true },
            { label: "Remove the test file", passed: result.delete === true },
          ],
          browserCors:
            typeof result.browserCors === "string"
              ? result.browserCors
              : "not checked",
        })
      } else {
        setMessage({
          kind: "cleanup",
          expired: typeof result.expired === "number" ? result.expired : 0,
          cancelled: typeof result.cancelled === "number" ? result.cancelled : 0,
          attempted: typeof result.attempted === "number" ? result.attempted : 0,
          deleted: typeof result.deleted === "number" ? result.deleted : 0,
        })
      }
      await query.refetch()
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Storage operation failed."
      )
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <Heading
        eyebrow="Private video storage"
        title="Video storage"
        description="The shared 8 GB allowance counts stored objects, upload reservations, and objects awaiting confirmed deletion."
      />
      <QueryState
        pending={query.isPending}
        error={query.error}
        retry={() => void query.refetch()}
      />
      {query.data ? (
        <>
          <div className="gv-panel mb-6">
            <p className="font-bold">
              {query.data.configuration.configured
                ? "R2 configuration present"
                : "R2 configuration required"}
            </p>
            {query.data.configuration.missing.length ? (
              <p className="mt-2 text-sm">
                Missing: {query.data.configuration.missing.join(", ")}
              </p>
            ) : null}
            {/* <p className="mt-2 text-xs">
              Credentials and signed URLs are never shown. See
              docs/R2_VIDEO_SETUP.md for bucket setup, CORS, and deployment
              steps.
            </p> */}
          </div>
          <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["Stored", query.data.usage.stored],
                ["Reserved", query.data.usage.reserved],
                ["Pending cleanup", query.data.usage.pendingCleanup],
                ["Available", query.data.usage.available],
              ] as const
            ).map(([label, value]) => (
              <div className="gv-panel" key={label}>
                <p className="text-xs font-bold text-slate-600">{label}</p>
                <p className="mt-2 text-2xl font-bold">{formatBytes(value)}</p>
              </div>
            ))}
          </div>
          <div className="mb-6 flex flex-wrap gap-3">
            <button
              className="gv-action"
              disabled={busy || !query.data.configuration.configured}
              onClick={() => void action("diagnostics")}
            >
              Run connection check
            </button>
            <button
              className="gv-action secondary"
              disabled={busy || !query.data.configuration.configured}
              onClick={() => void action("cleanup")}
            >
              Retry cleanup & reconcile
            </button>
            <button
              className="gv-action secondary"
              disabled={busy}
              onClick={() => void query.refetch()}
            >
              Refresh
            </button>
          </div>
          {message ? (
            typeof message === "string" ? (
              <p role="status" className="gv-panel mb-6 text-sm break-words">
                {message}
              </p>
            ) : message.kind === "diagnostics" ? (
              <section role="status" aria-live="polite" className="gv-panel mb-6">
                <h2 className="font-bold">Connection check results</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  {message.checks.map((check) => (
                    <li key={check.label}>
                      <span aria-hidden="true">{check.passed ? "✓" : "✗"}</span>{" "}
                      {check.label}: {check.passed ? "Passed" : "Not confirmed"}
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-sm">
                  Browser access: {message.browserCors === "Verify separately in the browser"
                    ? "Not checked. Test video playback in a web browser to confirm this."
                    : message.browserCors}
                </p>
              </section>
            ) : (
              <section role="status" aria-live="polite" className="gv-panel mb-6">
                <h2 className="font-bold">Storage cleanup results</h2>
                <ul className="mt-3 space-y-2 text-sm">
                  <li>Expired uploads found: {message.expired}</li>
                  <li>Uploads successfully cancelled: {message.cancelled}</li>
                  <li>Stored files checked for removal: {message.attempted}</li>
                  <li>Stored files removed: {message.deleted}</li>
                </ul>
              </section>
            )
          ) : null}
          <section className="gv-panel">
            <h2 className="text-xl font-bold">Unfinished uploads</h2>
            <p className="mt-2 text-xs">
              Expired sessions retain their reservation until abortion and
              deletion are confirmed. Retry cleanup to recover them.
            </p>
            {query.data.sessions.length ? (
              query.data.sessions.map((s) => (
                <div className="mt-4 rounded-lg bg-white p-4" key={s.id}>
                  <p className="font-bold">{s.destination}</p>
                  <p className="mt-1 text-xs break-words">
                    {s.filename} · {formatBytes(s.fileSize)} · {s.status}
                  </p>
                  <p className="mt-1 text-xs">
                    Expires {new Date(s.expiresAt).toLocaleString()}
                    {s.lastError ? ` · ${s.lastError}` : ""}
                  </p>
                </div>
              ))
            ) : (
              <p className="mt-4 text-sm">No unfinished uploads.</p>
            )}
          </section>
          <section className="gv-panel mt-6">
            <h2 className="text-xl font-bold">Stored objects & cleanup</h2>
            {query.data.objects.length ? (
              query.data.objects.map((o) => (
                <div key={o.id} className="mt-3 rounded bg-white p-3 text-sm">
                  {formatBytes(o.bytes)} · {o.state} ·{" "}
                  {o.asset ? "Attached" : "Detached"}
                  {o.lastError ? ` · ${o.lastError}` : ""}
                </div>
              ))
            ) : (
              <p className="mt-4 text-sm">No managed video objects yet.</p>
            )}
          </section>
        </>
      ) : null}
    </>
  )
}
