import "server-only"
import { getPrisma } from "@/lib/prisma"
import { PlatformError } from "@/lib/platform-error"

export async function assertVideoProcessorAvailable() {
  const heartbeat = await getPrisma().videoProcessorHeartbeat.findUnique({
    where: { id: "default" },
  })
  if (!heartbeat || heartbeat.seenAt.getTime() < Date.now() - 90_000)
    throw new PlatformError(
      503,
      "VIDEO_PROCESSOR_OFFLINE",
      "Automatic video preparation is offline. Ask an administrator to start the video worker, then retry. Prepared fast-start MP4 uploads can still be used."
    )
}
