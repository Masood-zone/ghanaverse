import { createFile, MP4BoxBuffer, type Movie } from "mp4box"
import { videoMetadataSchema } from "@/lib/validation/video"
import { VIDEO_HEADER_BYTES, VIDEO_PREPARATION } from "./constants"

// Only the bounded fast-start header is parsed; sample data is never retained.
export function inspectMp4Header(bytes: ArrayBuffer) {
  if (bytes.byteLength > VIDEO_HEADER_BYTES) throw new Error(VIDEO_PREPARATION)
  const parser = createFile(false)
  let info: Movie | undefined
  let failure: string | undefined
  parser.onReady = (value) => {
    info = value
  }
  parser.onError = () => {
    failure = VIDEO_PREPARATION
  }
  const buffer = MP4BoxBuffer.fromArrayBuffer(bytes, 0)
  try {
    parser.appendBuffer(buffer)
  } catch {
    throw new Error(VIDEO_PREPARATION)
  }
  if (
    failure ||
    !info ||
    !info.isProgressive ||
    info.isFragmented ||
    info.videoTracks.length !== 1
  )
    throw new Error(VIDEO_PREPARATION)
  const video = info.videoTracks[0]
  const result = videoMetadataSchema.safeParse({
    durationSeconds: info.duration / info.timescale,
    width: video.video?.width,
    height: video.video?.height,
    videoCodec: video.codec,
    audioCodecs: info.audioTracks.map((track) => track.codec),
    progressive: true,
  })
  if (!result.success) throw new Error(VIDEO_PREPARATION)
  return result.data
}
