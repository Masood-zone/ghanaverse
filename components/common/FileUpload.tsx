"use client"
import { Input } from "@/components/ui/input"
import { useDropzone } from "react-dropzone"
import { ContentArtwork } from "@/components/catalogue/content-artwork"
import { MaterialSymbol } from "./MaterialSymbol"
import { useUploadFile } from "@/services/uploads/uploads"
import type { UploadedArtwork } from "@/types/uploads"
import { MAX_ARTWORK_BYTES, type UploadPurpose } from "@/lib/validation/uploads"
export default function FileUpload({
  value,
  purpose,
  onFilesUploaded,
  label,
  disabled = false,
  contentId,
}: {
  value?: string | null
  purpose: UploadPurpose
  onFilesUploaded: (file: UploadedArtwork | null) => void
  label: string
  disabled?: boolean
  contentId?: string
}) {
  const mutation = useUploadFile()
  const { getRootProps, getInputProps, isDragActive, fileRejections } =
    useDropzone({
      multiple: false,
      disabled: disabled || mutation.isPending,
      maxSize: MAX_ARTWORK_BYTES,
      accept: {
        "image/jpeg": [".jpg", ".jpeg"],
        "image/png": [".png"],
        "image/webp": [".webp"],
      },
      onDropAccepted: (files) => {
        if (files[0])
          mutation.mutate(
            { file: files[0], purpose, contentId },
            { onSuccess: onFilesUploaded }
          )
      },
    })
  return (
    <div className="space-y-3">
      <p className="gv-label">{label}</p>
      {value ? (
        <div
          className={`relative overflow-hidden rounded-lg bg-white ${purpose === "poster" ? "mx-auto aspect-[2/3] max-w-40" : "aspect-video"}`}
        >
          <ContentArtwork src={value} alt={label} />
        </div>
      ) : null}
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-lg border border-dashed bg-white p-5 text-center ${isDragActive ? "border-primary bg-orange-50" : "border-slate-300"}`}
        aria-label={`Upload ${label}`}
      >
        <Input {...getInputProps()} />
        <MaterialSymbol
          icon={mutation.isPending ? "progress_activity" : "cloud_upload"}
          className={
            mutation.isPending ? "animate-spin text-primary" : "text-primary"
          }
        />
        <p className="mt-2 text-xs font-semibold">
          {mutation.isPending
            ? "Uploading…"
            : value
              ? "Drop or browse to replace"
              : "Drop an image or browse"}
        </p>
        <p className="mt-1 text-[11px] text-muted-foreground">
          JPEG, PNG or WebP · up to 8 MB
        </p>
      </div>
      {mutation.error ? (
        <p role="alert" className="text-xs text-red-700">
          {mutation.error.message}
        </p>
      ) : null}
      {fileRejections.length ? (
        <p role="alert" className="text-xs text-red-700">
          Choose a supported image up to 8 MB.
        </p>
      ) : null}
      {value && !disabled ? (
        <button
          type="button"
          className="text-xs font-semibold text-red-700"
          disabled={mutation.isPending}
          onClick={() => onFilesUploaded(null)}
        >
          Remove image reference
        </button>
      ) : null}
    </div>
  )
}
