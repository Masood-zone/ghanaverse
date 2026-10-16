import "dotenv/config"
import { setTimeout as wait } from "node:timers/promises"
import { getPrisma } from "../lib/prisma"
import { checkMediaTools } from "../lib/video/process-media"
import {
  heartbeatVideoProcessor,
  processNextVideo,
} from "../services/video/processing"
import { cleanupVideoStorage } from "../services/video/uploads"
import { r2Configuration } from "../lib/r2/provider"

const controller = new AbortController()
process.once("SIGINT", () => controller.abort())
process.once("SIGTERM", () => controller.abort())
async function main() {
  await checkMediaTools()
  if (!r2Configuration().configured) throw new Error("R2_NOT_CONFIGURED")
  await heartbeatVideoProcessor()
  const heartbeat = setInterval(() => {
    void heartbeatVideoProcessor().catch(() => controller.abort())
  }, 15_000)
  console.log(
    "Video worker ready (MP4 and WebM playback; automatic preparation enabled)."
  )
  try {
    await cleanupVideoStorage()
    do {
      const result = await processNextVideo(controller.signal)
      if (result) console.log(JSON.stringify(result))
      if (process.argv.includes("--once")) break
      if (!result) await wait(5000, undefined, { signal: controller.signal })
    } while (!controller.signal.aborted)
  } finally {
    clearInterval(heartbeat)
  }
}
main()
  .catch(() => {
    if (!controller.signal.aborted) {
      console.error(
        "VIDEO_WORKER_FAILED: Check FFmpeg, FFprobe, database migrations and private R2 configuration. No private paths or signed URLs are logged."
      )
      process.exitCode = 1
    }
  })
  .finally(async () => {
    await getPrisma().$disconnect()
  })
