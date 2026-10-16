"use client"
import { useRef, useState } from "react"
import { PersonAvatar } from "@/components/catalogue/content-artwork"
import axios from "@/lib/axios"
import { MAX_ARTWORK_BYTES, allowedImageTypes } from "@/lib/validation/uploads"
import type { ApiResponse } from "@/types"

export function PhotoUpload({
  name,
  image,
  target,
  profileId,
  onChange,
  onBusy,
  disabled = false,
}: {
  name: string
  image?: string | null
  target: "account" | "profile"
  profileId?: string
  onChange: (assetId: string | null, image: string | null) => void
  onBusy?: (busy: boolean) => void
  disabled?: boolean
}) {
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState("")
  const input = useRef<HTMLInputElement>(null)
  async function upload(file?: File) {
    if (!file) return
    setError("")
    if (
      !allowedImageTypes.includes(file.type) ||
      !file.size ||
      file.size > MAX_ARTWORK_BYTES
    ) {
      setError("Choose a JPEG, PNG or WebP image up to 8 MB.")
      return
    }
    setProgress(0)
    onBusy?.(true)
    try {
      const body = new FormData()
      body.set("file", file)
      body.set("target", target)
      if (profileId) body.set("profileId", profileId)
      const response = await axios.post<
        ApiResponse<{ id: string; secureUrl: string }>
      >("/viewer/uploads", body, {
        timeout: 120000,
        onUploadProgress: (event) =>
          setProgress(
            event.total ? Math.round((event.loaded / event.total) * 100) : 0
          ),
      })
      if (!response.data.success || !response.data.data)
        throw new Error(response.data.message ?? "Photo upload failed.")
      onChange(response.data.data.id, response.data.data.secureUrl)
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Photo upload failed. Try again."
      )
    } finally {
      setProgress(null)
      onBusy?.(false)
      if (input.current) input.current.value = ""
    }
  }
  const busy = progress !== null
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        <PersonAvatar
          name={name || "Profile"}
          src={image}
          className="h-20 w-20 text-2xl"
        />
        <div>
          <label className="gv-action secondary cursor-pointer">
            {busy ? "Uploading…" : image ? "Replace photo" : "Upload photo"}
            <input
              ref={input}
              type="file"
              aria-label={`Upload ${target} photo`}
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled || busy}
              onChange={(event) => void upload(event.target.files?.[0])}
            />
          </label>
          <p className="mt-2 text-xs text-muted-foreground">
            JPEG, PNG or WebP · up to 8 MB
          </p>
        </div>
      </div>
      {busy ? (
        <div role="status" className="text-sm text-primary">
          <progress
            aria-label="Photo upload progress"
            max={100}
            value={progress}
            className="mr-2"
          />
          {progress < 100 ? `${progress}%` : "Processing photo…"}
        </div>
      ) : null}
      {image ? (
        <button
          type="button"
          disabled={disabled || busy}
          className="text-xs font-semibold text-red-700 disabled:opacity-50"
          onClick={() => onChange(null, null)}
        >
          Remove photo
        </button>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Preview your photo above. Save your changes to apply it.
      </p>
      {error ? (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  )
}
