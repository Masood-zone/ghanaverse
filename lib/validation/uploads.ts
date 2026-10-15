import { z } from "zod"
export const uploadPurposeSchema = z.enum([
  "poster",
  "backdrop",
  "creatorPortrait",
  "episodeThumbnail",
])
export type UploadPurpose = z.infer<typeof uploadPurposeSchema>
export const MAX_ARTWORK_BYTES = 8 * 1024 * 1024
export const allowedImageTypes = ["image/jpeg", "image/png", "image/webp"]
