export const VIDEO_PART_BYTES = 16 * 1024 * 1024
export const VIDEO_HEADER_BYTES = 8 * 1024 * 1024
export const VIDEO_UPLOAD_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000
export const VIDEO_PREFIX = "ghanaverse/video/"
export const VIDEO_PREPARATION =
  "Prepare an H.264 video with AAC audio in an MP4 container, with metadata at the start (fast start)."
export const VIDEO_UPLOAD_ACCEPT =
  ".mp4,.m4v,.mov,.webm,.mkv,.avi,.wmv,.flv,.mpg,.mpeg,.ts,.mts,.m2ts,.3gp,.ogv"
export const VIDEO_UPLOAD_HELP =
  "Upload MP4, MOV, WebM, MKV, AVI, WMV, FLV, MPEG, TS, 3GP or OGV. Videos are checked and prepared for playback automatically."
const videoTypes: Record<string, string> = {
  mp4: "video/mp4",
  m4v: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
  avi: "video/x-msvideo",
  wmv: "video/x-ms-wmv",
  flv: "video/x-flv",
  mpg: "video/mpeg",
  mpeg: "video/mpeg",
  ts: "video/mp2t",
  mts: "video/mp2t",
  m2ts: "video/mp2t",
  "3gp": "video/3gpp",
  ogv: "video/ogg",
}
export function videoExtension(filename: string) {
  const extension = filename.split(".").pop()?.toLowerCase() ?? ""
  return Object.hasOwn(videoTypes, extension) ? extension : null
}
export function videoContentType(filename: string) {
  const extension = videoExtension(filename)
  return extension ? videoTypes[extension] : null
}
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
