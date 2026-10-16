export const VIDEO_PART_BYTES = 16 * 1024 * 1024
export const VIDEO_HEADER_BYTES = 8 * 1024 * 1024
export const VIDEO_UPLOAD_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
export const VIDEO_PREFIX = "ghanaverse/video/"
export const VIDEO_PREPARATION =
  "Prepare an H.264 video with AAC audio in an MP4 container, with metadata at the start (fast start)."
export function partBytes(size: number, number: number) {
  return Math.max(
    0,
    Math.min(VIDEO_PART_BYTES, size - (number - 1) * VIDEO_PART_BYTES)
  )
}
export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  const unit = Math.min(3, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / 1024 ** unit).toFixed(1)} ${["B", "KiB", "MiB", "GiB"][unit]}`
}
