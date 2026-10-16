"use client"
import { useRef, useState } from "react"
import { toast } from "sonner"
import { VIDEO_UPLOAD_ACCEPT, VIDEO_UPLOAD_HELP } from "@/lib/video/constants"
export function VideoUploadButton({
  contentId,
  episodeId = null,
  label,
  rights,
  disabled = false,
  compact = false,
}: {
  contentId: string
  episodeId?: string | null
  label: string
  rights: string
  disabled?: boolean
  compact?: boolean
}) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const allowed =
    rights === "ORIGINAL" ||
    rights === "LICENSED" ||
    rights === "CREATIVE_COMMONS" ||
    rights === "PUBLIC_DOMAIN"
  return (
    <div className="space-y-2">
      <button
        type="button"
        className="gv-action secondary"
        disabled={disabled || busy || !allowed}
        onClick={() => input.current?.click()}
      >
        {busy ? "Checking video…" : "Upload Video"}
      </button>
      <input
        ref={input}
        className="sr-only"
        aria-label={`Upload video to ${label}`}
        type="file"
        accept={VIDEO_UPLOAD_ACCEPT}
        disabled={disabled || busy || !allowed}
        onChange={async (event) => {
          const file = event.currentTarget.files?.[0]
          event.currentTarget.value = ""
          if (!file || !allowed) return
          setBusy(true)
          try {
            const { queueVideo } = await import("@/lib/video/browser-upload")
            await queueVideo(file, {
              contentId,
              episodeId,
              label,
              licenseType: rights,
            })
            toast.success(`Video queued for ${label}`)
          } catch (error) {
            toast.error(
              error instanceof Error
                ? error.message
                : "Video could not be queued."
            )
          } finally {
            setBusy(false)
          }
        }}
      />
      {!allowed ? (
        <p className="text-xs text-amber-900">
          Record and save the media rights before uploading.
        </p>
      ) : null}
      {!compact ? (
        <p className="max-w-xl text-xs text-slate-600">
          {VIDEO_UPLOAD_HELP} Maximum shared application storage: 8 GB,
          including unfinished uploads.
        </p>
      ) : null}
    </div>
  )
}
