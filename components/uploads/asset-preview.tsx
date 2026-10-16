"use client"
import { useRef, useState } from "react"
import { videoRequest } from "@/lib/video/client-api"
export function AssetPreview({
  id,
  label = "Preview",
}: {
  id: string
  label?: string
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [source, setSource] = useState<{
    kind: string
    url: string
    videoId?: string
  } | null>(null)
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false)
  async function load() {
    setBusy(true)
    setError("")
    try {
      setSource(
        await videoRequest(`playback/assets/${id}/source`, "POST", {
          preview: true,
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview could not start.")
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      <button
        type="button"
        className="font-semibold text-amber-900 underline"
        onClick={() => {
          dialog.current?.showModal()
          void load()
        }}
      >
        {label}
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-[min(900px,94vw)] rounded-xl bg-white p-5 text-slate-900 shadow-2xl backdrop:bg-black/70"
        onClose={() => setSource(null)}
        aria-label="Private video preview"
      >
        <div className="mb-4 flex justify-between gap-4">
          <h2 className="font-bold">Private video preview</h2>
          <button
            type="button"
            autoFocus
            onClick={() => dialog.current?.close()}
            aria-label="Close video preview"
          >
            Close ✕
          </button>
        </div>
        <p className="mb-3 text-xs">
          This preview does not record viewer streams. Review it before enabling
          playback.
        </p>
        {busy ? (
          <p role="status">Loading preview…</p>
        ) : error ? (
          <p role="alert" className="text-red-700">
            {error}{" "}
            <button
              type="button"
              onClick={() => void load()}
              className="underline"
            >
              Retry
            </button>
          </p>
        ) : source ? (
          source.kind === "youtube" ? (
            <iframe
              title="Private video preview"
              className="aspect-video w-full"
              src={`https://www.youtube-nocookie.com/embed/${source.videoId}`}
              allow="fullscreen"
              allowFullScreen
            />
          ) : (
            <video
              aria-label="Private video preview"
              className="aspect-video w-full bg-black"
              src={source.url}
              controls
              playsInline
              preload="metadata"
              onError={() =>
                setError(
                  "Preview source may have expired. Retry to get a fresh source."
                )
              }
            />
          )
        ) : null}
      </dialog>
    </>
  )
}
