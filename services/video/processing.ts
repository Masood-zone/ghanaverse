import "server-only"
import { mkdtemp, rm, statfs } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve, dirname, basename } from "node:path"
import { getPrisma } from "@/lib/prisma"
import { r2 } from "@/lib/r2/provider"
import { PlatformError } from "@/lib/platform-error"
import { prepareVideo } from "@/lib/video/process-media"
import { storageUsage } from "./storage"
import {
  attachVideoUpload,
  cancelVideoUpload,
  cleanupProcessedSource,
  operateVideoUpload,
} from "./uploads"

export async function heartbeatVideoProcessor() {
  await getPrisma().videoProcessorHeartbeat.upsert({
    where: { id: "default" },
    create: { id: "default", seenAt: new Date() },
    update: { seenAt: new Date() },
  })
}
export async function processNextVideo(signal?: AbortSignal) {
  const db = getPrisma()
  const candidate = await db.videoUploadSession.findFirst({
    where: {
      status: { in: ["PROCESSING", "CANCELLING"] },
      OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }],
    },
    orderBy: { createdAt: "asc" },
  })
  if (!candidate) return null
  if (
    candidate.status === "CANCELLING" ||
    candidate.expiresAt.getTime() <= Date.now()
  ) {
    await cancelVideoUpload(null, candidate.id)
    return { id: candidate.id, status: "CANCELLED" }
  }
  try {
    return await operateVideoUpload(candidate.id, null, async (session) => {
      if (session.status !== "PROCESSING")
        return { id: session.id, status: session.status }
      const controller = new AbortController()
      const abort = () => controller.abort()
      signal?.addEventListener("abort", abort, { once: true })
      if (signal?.aborted) controller.abort()
      // Renew the operation lease independently of long conversions and observe cancellation.
      const renew = setInterval(() => {
        void db.videoUploadSession
          .updateMany({
            where: {
              id: session.id,
              leaseToken: session.leaseToken,
              status: "PROCESSING",
            },
            data: { leaseUntil: new Date(Date.now() + 600_000) },
          })
          .then((result) => {
            if (!result.count) controller.abort()
          })
          .catch(() => controller.abort())
      }, 10_000)
      const root = resolve(process.env.VIDEO_PROCESSING_TEMP_DIR || tmpdir())
      let directory: string | undefined
      try {
        // Failed attempts can leave a prepared object or multipart upload. Confirm deletion
        // before releasing its reservation, so retries cannot undercount replacement bytes.
        if (session.processingObjectKey) {
          const previous = {
            ...session,
            objectKey: session.processingObjectKey,
            providerUploadId: null,
          }
          await r2.abort(previous)
          await r2.delete(previous)
          await db.$transaction(async (tx) => {
            await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
            await tx.videoStorageReservation.update({
              where: { sessionId: session.id },
              data: { bytes: session.fileSize },
            })
            await tx.videoUploadSession.update({
              where: { id: session.id },
              data: { processingBytes: null, processingObjectKey: null },
            })
          })
        }
        directory = await mkdtemp(join(root, "ghanaverse-video-"))
        const disk = await statfs(directory)
        if (
          disk.bavail * disk.bsize <
          Number(session.fileSize) * 2 + 256 * 1024 * 1024
        )
          throw new PlatformError(
            503,
            "VIDEO_WORKER_DISK_FULL",
            "The video worker needs more temporary disk space. Ask an administrator to free space, then retry."
          )
        const input = join(directory, "source")
        await r2.download(
          session,
          input,
          Number(session.fileSize),
          controller.signal
        )
        const usage = await storageUsage()
        const available = Math.min(
          usage.available,
          disk.bavail * disk.bsize -
            Number(session.fileSize) -
            256 * 1024 * 1024
        )
        if (available < 1024)
          throw new PlatformError(
            409,
            "STORAGE_QUOTA_EXCEEDED",
            "Free video storage before retrying preparation. Both the original and prepared video need space temporarily."
          )
        const prepared = await prepareVideo(
          input,
          directory,
          available,
          controller.signal
        )
        controller.signal.throwIfAborted()
        const objectKey = `ghanaverse/video/${session.id}.playback.${prepared.extension}`
        await db.$transaction(async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
          const current = await tx.videoUploadSession.findUniqueOrThrow({
            where: { id: session.id },
          })
          if (
            current.status !== "PROCESSING" ||
            current.leaseToken !== session.leaseToken
          )
            throw new PlatformError(
              409,
              "UPLOAD_BUSY",
              "Video preparation was cancelled or its lease was lost."
            )
          const now = await storageUsage(tx)
          if (
            prepared.bytes >
            now.available + Number(current.processingBytes ?? 0)
          )
            throw new PlatformError(
              409,
              "STORAGE_QUOTA_EXCEEDED",
              "Free video storage before retrying preparation."
            )
          await tx.videoStorageReservation.update({
            where: { sessionId: session.id },
            data: { bytes: session.fileSize + BigInt(prepared.bytes) },
          })
          await tx.videoUploadSession.update({
            where: { id: session.id },
            data: {
              processingObjectKey: objectKey,
              processingBytes: BigInt(prepared.bytes),
            },
          })
        })
        const target = { ...session, objectKey }
        // A crashed upload may leave a multipart intent; clear it before streaming the new output.
        await r2.abort({ ...target, providerUploadId: null })
        await r2.uploadPrepared(
          target,
          session.id,
          prepared.path,
          prepared.bytes,
          controller.signal
        )
        controller.signal.throwIfAborted()
        const object = await r2.head(target)
        if (
          !object ||
          object.bytes !== prepared.bytes ||
          object.sessionId !== session.id ||
          object.contentType !== prepared.metadata.contentType ||
          !object.etag
        )
          throw new PlatformError(
            422,
            "OBJECT_VERIFICATION_FAILED",
            "The prepared video failed storage verification. Retry preparation."
          )
        return await attachVideoUpload(
          session,
          { objectKey, bytes: prepared.bytes, etag: object.etag },
          prepared.metadata
        )
      } finally {
        clearInterval(renew)
        signal?.removeEventListener("abort", abort)
        if (
          directory &&
          dirname(directory) === root &&
          basename(directory).startsWith("ghanaverse-video-")
        )
          await rm(directory, { recursive: true, force: true, maxRetries: 3 })
      }
    })
  } catch (error) {
    if (error instanceof PlatformError && error.code === "UPLOAD_BUSY")
      return null
    const message =
      error instanceof PlatformError && error.code !== "R2_OPERATION_FAILED"
        ? error.message
        : "Video preparation was interrupted. Retry processing; the original upload is retained."
    await db.videoUploadSession.updateMany({
      where: { id: candidate.id, status: "PROCESSING", leaseToken: null },
      data: {
        status: signal?.aborted ? "PROCESSING" : "PROCESSING_FAILED",
        lastError: message,
      },
    })
    return { id: candidate.id, status: "PROCESSING_FAILED" }
  } finally {
    const current = await db.videoUploadSession.findUnique({
      where: { id: candidate.id },
    })
    if (current?.status === "COMPLETED") {
      try {
        await cleanupProcessedSource(current.id)
      } catch {
        await db.videoUploadSession.update({
          where: { id: current.id },
          data: { lastError: "SOURCE_CLEANUP_PENDING" },
        })
      }
    } else if (current?.status === "CANCELLING" && !current.leaseToken)
      await cancelVideoUpload(null, current.id)
  }
}
