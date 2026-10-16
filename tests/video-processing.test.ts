import { describe, expect, it } from "vitest"
import { playbackPlan, type Probe } from "@/lib/video/process-media"
import { createVideoUploadSchema } from "@/lib/validation/video"
import { videoContentType, videoExtension } from "@/lib/video/constants"
const probe = (video: string, audio?: string, pixel = "yuv420p"): Probe => ({
  format: { duration: 20 },
  streams: [
    {
      index: 0,
      codec_type: "video",
      codec_name: video,
      pix_fmt: pixel,
      width: 1920,
      height: 1080,
    },
    ...(audio ? [{ index: 1, codec_type: "audio", codec_name: audio }] : []),
  ],
})
describe("video preparation decisions", () => {
  it.each(["vp8", "vp9", "av1"])(
    "keeps %s and Opus as WebM without re-encoding",
    (codec) => {
      expect(playbackPlan(probe(codec, "opus"))).toMatchObject({
        contentType: "video/webm",
        copyVideo: true,
        copyAudio: true,
      })
    }
  )
  it("remuxes normal H.264/AAC MP4 files without a quality-losing encode", () => {
    expect(playbackPlan(probe("h264", "aac"))).toMatchObject({
      extension: "mp4",
      copyVideo: true,
      copyAudio: true,
    })
  })
  it("converts incompatible audio while retaining a VP9 video track", () => {
    expect(playbackPlan(probe("vp9", "ac3"))).toMatchObject({
      contentType: "video/webm",
      copyVideo: true,
      copyAudio: false,
    })
  })
  it.each([
    probe("hevc", "ac3"),
    probe("mpeg4", "mp3"),
    probe("h264", "aac", "yuv420p10le"),
  ])(
    "converts codecs or pixel formats that need a playback fallback",
    (media) => {
      expect(playbackPlan(media)).toMatchObject({
        extension: "mp4",
        copyVideo: false,
      })
    }
  )
  it.each([
    "recording.MOV",
    "film.mkv",
    "video.webm",
    "clip.avi",
    "film.wmv",
    "clip.mts",
    "clip.3gp",
    "clip.ogv",
  ])(
    "accepts %s as an input without claiming verified codec metadata",
    (filename) => {
      const parsed = createVideoUploadSchema.parse({
        idempotencyKey: "6db09a30-39cb-44b5-b858-f1bbd3f9c3d0",
        contentId: "content",
        filename,
        fileSize: 100,
        lastModified: 1,
        fingerprint: "a".repeat(64),
        licenseType: "ORIGINAL",
      })
      expect(parsed.mediaMetadata).toBeNull()
      expect(videoContentType(filename)).toBeTruthy()
    }
  )
  it.each(["script.html", "film.mp4.exe", "clip.m3u8", "clip.concat", ""])(
    "does not accept %s as a source video",
    (name) => {
      expect(videoExtension(name)).toBeNull()
    }
  )
})
