import { spawn } from "node:child_process"
import { stat } from "node:fs/promises"
import { join } from "node:path"
import { z } from "zod"
import { PlatformError } from "@/lib/platform-error"

const formats = "mov,matroska,webm,avi,asf,mpeg,mpegts,flv,ogg"
const probeSchema = z.object({
  format: z.object({ duration: z.coerce.number().positive().max(86400) }),
  streams: z
    .array(
      z.object({
        index: z.number().int(),
        codec_type: z.string(),
        codec_name: z.string().optional(),
        codec_tag_string: z.string().optional(),
        width: z.number().int().positive().max(8192).optional(),
        height: z.number().int().positive().max(8192).optional(),
        pix_fmt: z.string().optional(),
        profile: z.union([z.string(), z.number()]).optional(),
        disposition: z
          .object({ attached_pic: z.number().optional() })
          .optional(),
      })
    )
    .max(64),
})
export type Probe = z.infer<typeof probeSchema>
export type PreparedVideoMetadata = {
  durationSeconds: number
  width: number
  height: number
  videoCodec: string
  audioCodecs: string[]
  progressive: boolean
  contentType: "video/mp4" | "video/webm"
}
export function mediaExecutable(name: "ffmpeg" | "ffprobe") {
  return (
    process.env[name === "ffmpeg" ? "FFMPEG_PATH" : "FFPROBE_PATH"]?.trim() ||
    name
  )
}
// Files are local temporary files. Disable network/playlist demuxers and shell execution.
export function runMediaTool(
  name: "ffmpeg" | "ffprobe",
  args: string[],
  signal?: AbortSignal,
  timeout = 120_000
) {
  return new Promise<string>((resolve, reject) => {
    const child = spawn(mediaExecutable(name), args, {
      windowsHide: true,
      shell: false,
      signal,
      stdio: ["ignore", "pipe", "ignore"],
    })
    const timer = setTimeout(() => child.kill("SIGKILL"), timeout)
    let output = "",
      overflow = false
    child.stdout.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      output += chunk
      if (output.length > 1_048_576) {
        overflow = true
        child.kill("SIGKILL")
      }
    })
    child.once("error", () => {
      clearTimeout(timer)
      reject(
        new PlatformError(
          503,
          "VIDEO_PROCESSOR_UNAVAILABLE",
          "Video processing tools are unavailable. Ask an administrator to check the video worker."
        )
      )
    })
    child.once("close", (code) => {
      clearTimeout(timer)
      if (code === 0 && !overflow && !signal?.aborted) resolve(output)
      else
        reject(
          new PlatformError(
            422,
            "VIDEO_PROCESSING_FAILED",
            "This video could not be decoded or prepared. It may be damaged, encrypted, or use an unsupported codec. Try another video or retry processing."
          )
        )
    })
  })
}
export async function checkMediaTools() {
  await runMediaTool("ffmpeg", ["-version"])
  await runMediaTool("ffprobe", ["-version"])
}
export async function probeVideo(
  path: string,
  signal?: AbortSignal
): Promise<Probe> {
  const output = await runMediaTool(
    "ffprobe",
    [
      "-v",
      "error",
      "-protocol_whitelist",
      "file,pipe",
      "-format_whitelist",
      formats,
      "-show_format",
      "-show_streams",
      "-of",
      "json",
      path,
    ],
    signal
  )
  const parsed = probeSchema.safeParse(JSON.parse(output))
  if (
    parsed.success &&
    parsed.data.streams.some((stream) =>
      ["encv", "enca"].includes(stream.codec_tag_string ?? "")
    )
  )
    throw new PlatformError(
      422,
      "ENCRYPTED_VIDEO",
      "Encrypted videos cannot be prepared for playback. Choose an unencrypted source video."
    )
  const video = parsed.success
    ? parsed.data.streams.find(
        (s) => s.codec_type === "video" && !s.disposition?.attached_pic
      )
    : undefined
  if (!parsed.success || !video?.width || !video.height || !video.codec_name)
    throw new PlatformError(
      422,
      "INVALID_VIDEO",
      "Choose a real video with a readable duration and video track (up to 24 hours and 8192 pixels per dimension)."
    )
  return parsed.data
}
export function playbackPlan(probe: Probe) {
  const video = probe.streams.find(
    (s) => s.codec_type === "video" && !s.disposition?.attached_pic
  )!
  const audio = probe.streams.find((s) => s.codec_type === "audio")
  const webm =
    ["vp8", "vp9", "av1"].includes(video.codec_name ?? "") &&
    ["yuv420p", "yuvj420p"].includes(video.pix_fmt ?? "")
  const copyVideo =
    webm ||
    (video.codec_name === "h264" &&
      ["yuv420p", "yuvj420p"].includes(video.pix_fmt ?? ""))
  const copyAudio =
    !audio ||
    (webm ? ["opus", "vorbis"] : ["aac", "mp3"]).includes(
      audio.codec_name ?? ""
    )
  return {
    video,
    audio,
    webm,
    copyVideo,
    copyAudio,
    extension: webm ? "webm" : "mp4",
    contentType: webm ? ("video/webm" as const) : ("video/mp4" as const),
  }
}
export async function prepareVideo(
  input: string,
  directory: string,
  maxBytes: number,
  signal?: AbortSignal
) {
  const original = await probeVideo(input, signal)
  const plan = playbackPlan(original)
  const output = join(directory, `playback.${plan.extension}`)
  const args = [
    "-hide_banner",
    "-loglevel",
    "error",
    "-nostdin",
    "-xerror",
    "-y",
    "-protocol_whitelist",
    "file,pipe",
    "-format_whitelist",
    formats,
    "-threads",
    "2",
    "-filter_threads",
    "2",
    "-i",
    input,
    "-map",
    `0:${plan.video.index}`,
    ...(plan.audio ? ["-map", `0:${plan.audio.index}`] : []),
    "-map_metadata",
    "-1",
    "-map_chapters",
    "-1",
    "-c:v",
    plan.copyVideo ? "copy" : "libx264",
    ...(plan.copyVideo
      ? []
      : [
          "-preset",
          "veryfast",
          "-crf",
          "22",
          "-pix_fmt",
          "yuv420p",
          "-vf",
          "scale=trunc(iw/2)*2:trunc(ih/2)*2",
        ]),
    "-c:a",
    plan.copyAudio ? "copy" : plan.webm ? "libopus" : "aac",
    ...(plan.copyAudio ? [] : ["-b:a", "160k"]),
    "-threads",
    "2",
    ...(plan.webm ? ["-cues_to_front", "1"] : ["-movflags", "+faststart"]),
    "-fs",
    String(maxBytes),
    output,
  ]
  await runMediaTool("ffmpeg", args, signal, 6 * 60 * 60 * 1000)
  const verified = await probeVideo(output, signal)
  const preparedPlan = playbackPlan(verified)
  const bytes = (await stat(output)).size
  if (
    !bytes ||
    bytes > maxBytes ||
    Math.abs(verified.format.duration - original.format.duration) >
      Math.max(1, original.format.duration * 0.001)
  )
    throw new PlatformError(
      409,
      "VIDEO_OUTPUT_TOO_LARGE",
      "The prepared video does not fit in available storage. Free some space and retry processing."
    )
  if (
    !preparedPlan.copyVideo ||
    !preparedPlan.copyAudio ||
    preparedPlan.contentType !== plan.contentType
  )
    throw new PlatformError(
      422,
      "VIDEO_PROCESSING_FAILED",
      "The prepared video failed playback validation."
    )
  const metadata: PreparedVideoMetadata = {
    durationSeconds: verified.format.duration,
    width: preparedPlan.video.width!,
    height: preparedPlan.video.height!,
    videoCodec: preparedPlan.video.codec_name!,
    audioCodecs: preparedPlan.audio ? [preparedPlan.audio.codec_name!] : [],
    progressive: true,
    contentType: plan.contentType,
  }
  return {
    path: output,
    bytes,
    metadata,
    extension: plan.extension,
    remuxed: plan.copyVideo && plan.copyAudio,
  }
}
