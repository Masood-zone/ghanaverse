"use client"
import { Label } from "@/components/ui/label"
import { useEffect, useState, useSyncExternalStore } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  subscribeUploads,
  uploadSnapshot,
  emptyUploads,
  recoverUploads,
  resumeVideo,
  pauseVideo,
  cancelVideo,
  dismissVideo,
  setUploadIdentity,
  uploadsBelongTo,
  refreshProcessingUploads,
} from "@/lib/video/browser-upload"
import { authClient } from "@/lib/auth-client"
import { formatBytes, VIDEO_UPLOAD_ACCEPT } from "@/lib/video/constants"

export default function UploadDrawer() {
  const uploads = useSyncExternalStore(
    subscribeUploads,
    uploadSnapshot,
    () => emptyUploads
  )
  const [expanded, setExpanded] = useState(true)
  const client = useQueryClient(),
    path = usePathname()
  const session = authClient.useSession(),
    userId = session.data?.user.id
  const preparing = uploads.some((item) => item.state === "processing")
  useEffect(() => {
    if (!preparing || !userId) return
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout>
    async function refresh() {
      await refreshProcessingUploads(controller.signal)
      if (!controller.signal.aborted) timer = setTimeout(refresh, 5000)
    }
    void refresh()
    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [preparing, userId])
  useEffect(() => {
    if (session.isPending) return
    setUploadIdentity(userId ?? null)
    if (userId) void recoverUploads().catch(() => {})
  }, [userId, session.isPending])
  useEffect(() => {
    const refresh = () => {
      void client.invalidateQueries({ queryKey: ["admin"] })
      void client.invalidateQueries({ queryKey: ["creator"] })
    }
    const offline = () => {
      for (const item of uploadSnapshot())
        if (item.state === "uploading") pauseVideo(item.id)
    }
    const unloading = (event: BeforeUnloadEvent) => {
      if (
        uploadSnapshot().some((item) =>
          ["uploading", "checking", "queued"].includes(item.state)
        )
      ) {
        event.preventDefault()
        event.returnValue = ""
      }
    }
    window.addEventListener("ghanaverse:video-upload-complete", refresh)
    window.addEventListener("offline", offline)
    window.addEventListener("beforeunload", unloading)
    return () => {
      window.removeEventListener("ghanaverse:video-upload-complete", refresh)
      window.removeEventListener("offline", offline)
      window.removeEventListener("beforeunload", unloading)
    }
  }, [client])
  if (!uploads.length || !userId || !uploadsBelongTo(userId)) return null
  return (
    <aside
      aria-label="Video uploads"
      className="fixed right-3 bottom-3 z-50 w-[min(440px,calc(100vw-24px))] rounded-xl border bg-white text-slate-900 shadow-2xl"
    >
      <button
        className="flex w-full items-center justify-between rounded-t-xl bg-[#6b3700] p-4 text-left font-bold text-white"
        aria-expanded={expanded}
        onClick={() => setExpanded(!expanded)}
      >
        Video uploads ({uploads.length}) <span>{expanded ? "−" : "+"}</span>
      </button>
      {expanded ? (
        <div className="max-h-[65vh] space-y-4 overflow-y-auto p-4">
          <p className="text-xs text-slate-600">
            Keep this browser open to upload. You can resume confirmed parts for
            up to seven days after reselecting the original file. Preparation
            continues on the server after upload; you can close this page while
            it runs.
          </p>
          {uploads.map((item) => (
            <section className="space-y-2 rounded-lg border p-3" key={item.id}>
              <p className="text-sm font-bold break-words">{item.filename}</p>
              <Link
                href={`/${path.startsWith("/creator") ? "creator" : "admin"}/content/${item.contentId}?section=${item.episodeId ? "episodes" : "video"}`}
                className="block text-xs text-amber-900 underline"
              >
                {item.destination}
              </Link>
              <p role="status" className="text-xs font-semibold">
                {item.state === "needs-file"
                  ? "Reselect the original file"
                  : item.state === "processing"
                    ? item.status === "CANCELLING"
                      ? "Cancelling video…"
                      : "Upload finished · preparing playback…"
                    : item.state === "checking"
                      ? "Checking and confirming video…"
                      : item.state.replaceAll("-", " ")}
              </p>
              <progress
                aria-label={`Confirmed upload progress for ${item.filename}`}
                className="h-2 w-full accent-amber-800"
                value={item.confirmedBytes}
                max={item.fileSize}
              />
              <p className="text-xs tabular-nums">
                {Math.floor((item.confirmedBytes / item.fileSize) * 100)}%
                confirmed · {formatBytes(item.confirmedBytes)} /{" "}
                {formatBytes(item.fileSize)}
              </p>
              {item.state === "uploading" ? (
                <p className="text-xs text-slate-600">
                  Transferred: {formatBytes(item.transferredBytes)} ·{" "}
                  {item.bytesPerSecond
                    ? `${formatBytes(item.bytesPerSecond)}/s · about ${Math.ceil((item.fileSize - item.confirmedBytes) / item.bytesPerSecond / 60)} min left`
                    : "Measuring speed…"}
                </p>
              ) : null}
              {item.error ? (
                <p role="alert" className="text-xs text-red-700">
                  {item.error}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
                {["uploading", "checking", "queued"].includes(item.state) ? (
                  <button
                    onClick={() => pauseVideo(item.id)}
                    className="text-amber-900"
                  >
                    Pause
                  </button>
                ) : item.state === "processing" ? null : item.state ===
                  "complete" ? (
                  <button onClick={() => dismissVideo(item.id)}>Dismiss</button>
                ) : (
                  <>
                    <button
                      onClick={() =>
                        void resumeVideo(item.id).catch((e: Error) =>
                          toast.error(e.message)
                        )
                      }
                    >
                      {item.state === "failed" ? "Retry" : "Resume"}
                    </button>
                    {item.status !== "PROCESSING_FAILED" ? (
                      <Label className="cursor-pointer text-amber-900 underline">
                        Reselect video
                        <input
                          aria-label={`Reselect ${item.filename}`}
                          className="sr-only"
                          type="file"
                          accept={VIDEO_UPLOAD_ACCEPT}
                          onChange={(e) => {
                            const file = e.currentTarget.files?.[0]
                            if (file)
                              void resumeVideo(item.id, file).catch(
                                (error: Error) => toast.error(error.message)
                              )
                            e.currentTarget.value = ""
                          }}
                        />
                      </Label>
                    ) : null}
                  </>
                )}
                {item.state !== "complete" && item.status !== "CANCELLING" ? (
                  <button
                    className="text-red-700"
                    onClick={() => {
                      if (
                        confirm(
                          `Cancel ${item.filename}? Confirmed uploaded parts will be removed. Storage is released only after R2 confirms cleanup.`
                        )
                      )
                        void cancelVideo(item.id).catch((e: Error) =>
                          toast.error(e.message)
                        )
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
            </section>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
