import type { UploadPurpose } from "@/lib/validation/uploads"
export type UploadedArtwork = {
  id: string
  publicId: string
  secureUrl: string
  purpose: UploadPurpose
  width: number
  height: number
  bytes: number
}
