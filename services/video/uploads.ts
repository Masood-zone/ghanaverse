import "server-only"
import { createHash, randomUUID } from "node:crypto"
import type { VideoUploadSession } from "@/app/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { PlatformError } from "@/lib/platform-error"
import { r2, r2Identity, safeR2Error } from "@/lib/r2/provider"
import {
  createVideoUploadSchema,
  signVideoPartSchema,
} from "@/lib/validation/video"
import {
  VIDEO_PART_BYTES,
  VIDEO_HEADER_BYTES,
  VIDEO_PREFIX,
  VIDEO_UPLOAD_LIFETIME_MS,
  partBytes,
} from "@/lib/video/constants"
import { contentAccess, contentActor } from "@/services/content/access"
import { storageUsage, cleanupStoredObjects } from "./storage"
import { assertVideoProcessorAvailable } from "./processor-status"
import { videoExtension, videoContentType } from "@/lib/video/constants"
import type { VideoMetadata } from "@/lib/validation/video"
import type { PreparedVideoMetadata } from "@/lib/video/process-media"

export function videoUploadSummary(session: VideoUploadSession) {
  return {
    id: session.id,
    contentId: session.contentId,
    episodeId: session.episodeId,
    destination: session.destination,
    filename: session.filename,
    fileSize: Number(session.fileSize),
    lastModified: session.lastModified,
    fingerprint: session.fingerprint,
    status: session.status,
    expiresAt: session.expiresAt.toISOString(),
    createdAt: session.createdAt.toISOString(),
    lastError: session.lastError,
    assetId: session.assetId,
    partSize: VIDEO_PART_BYTES,
  }
}
const summary = videoUploadSummary
export type VideoUploadSummary = ReturnType<typeof summary>
export async function listVideoUploads(actorId: string) {
  const db = getPrisma()
  const user = await contentActor(db, actorId)
  const titles = await db.content.findMany({
    where:
      user.role === "ADMIN"
        ? {}
        : { rightsHolder: { memberships: { some: { userId: actorId } } } },
    select: { id: true },
  })
  return (
    await db.videoUploadSession.findMany({
      where: {
        contentId: { in: titles.map((t) => t.id) },
        status: { notIn: ["COMPLETED", "CANCELLED"] },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    })
  ).map(summary)
}
export async function createVideoUpload(actorId: string, raw: unknown) {
  const input = createVideoUploadSchema.parse(raw)
  if (!input.mediaMetadata) await assertVideoProcessorAvailable()
  const identity = r2Identity()
  const db = getPrisma()
  const session = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
      const content = await contentAccess(tx, actorId, input.contentId, true)
      const existing = await tx.videoUploadSession.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      })
      if (existing) {
        if (
          existing.actorId !== actorId ||
          existing.contentId !== input.contentId ||
          existing.episodeId !== input.episodeId ||
          Number(existing.fileSize) !== input.fileSize ||
          existing.fingerprint !== input.fingerprint ||
          existing.licenseType !== input.licenseType ||
          existing.filename !== input.filename
        )
          throw new PlatformError(
            409,
            "IDEMPOTENCY_CONFLICT",
            "This upload key already identifies another file or destination."
          )
        return existing
      }
      const episode = input.episodeId
        ? await tx.episode.findFirst({
            where: { id: input.episodeId, season: { seriesId: content.id } },
            include: { season: true },
          })
        : null
      if (
        (content.contentType === "SERIES" && !episode) ||
        (content.contentType !== "SERIES" && input.episodeId)
      )
        throw new PlatformError(
          400,
          "INVALID_DESTINATION",
          "Choose a valid movie or an episode belonging to this series."
        )
      const active = await tx.videoUploadSession.findFirst({
        where: {
          contentId: content.id,
          episodeId: input.episodeId,
          status: { notIn: ["CANCELLED", "COMPLETED"] },
        },
      })
      if (active)
        throw new PlatformError(
          409,
          "UPLOAD_ALREADY_EXISTS",
          "Resume or cancel the unfinished upload for this destination."
        )
      const usage = await storageUsage(tx)
      if (input.fileSize > usage.available)
        throw new PlatformError(
          409,
          "STORAGE_QUOTA_EXCEEDED",
          "There is not enough shared video storage. Free space or cancel another reservation first."
        )
      const id = randomUUID()
      return tx.videoUploadSession.create({
        data: {
          ...input,
          mediaMetadata: input.mediaMetadata ?? {},
          id,
          actorId,
          ...identity,
          fileSize: BigInt(input.fileSize),
          objectKey: `${VIDEO_PREFIX}${id}.${videoExtension(input.filename)}`,
          destination: episode
            ? `${content.title} · Season ${episode.season.seasonNumber} · Episode ${episode.episodeNumber}: ${episode.title}`
            : content.title,
          expiresAt: new Date(Date.now() + VIDEO_UPLOAD_LIFETIME_MS),
          reservation: { create: { bytes: BigInt(input.fileSize) } },
        },
      })
    },
    { maxWait: 15000, timeout: 20000 }
  )
  if (session.status === "INITIALIZING")
    await initializeVideoUpload(actorId, session.id)
  return summary(
    await db.videoUploadSession.findUniqueOrThrow({ where: { id: session.id } })
  )
}

export async function operateVideoUpload<T>(
  id: string,
  actorId: string | null,
  action: (session: VideoUploadSession) => Promise<T>,
  allowExpired = false
) {
  const db = getPrisma(),
    token = randomUUID()
  const session = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
      const current = await tx.videoUploadSession.findUnique({ where: { id } })
      if (!current)
        throw new PlatformError(
          404,
          "UPLOAD_NOT_FOUND",
          "Upload session was not found."
        )
      if (actorId)
        await contentAccess(
          tx,
          actorId,
          current.contentId,
          !allowExpired && current.status !== "COMPLETED"
        )
      if (
        !allowExpired &&
        current.expiresAt.getTime() <= Date.now() &&
        current.status !== "COMPLETED"
      )
        throw new PlatformError(
          410,
          "UPLOAD_EXPIRED",
          "This upload has expired. Cancel it to release its reservation, then start again."
        )
      if (current.status === "COMPLETED" || current.status === "CANCELLED")
        return current
      if (current.leaseUntil && current.leaseUntil.getTime() > Date.now())
        throw new PlatformError(
          409,
          "UPLOAD_BUSY",
          "Another tab or operation is using this upload. Retry when it finishes."
        )
      return tx.videoUploadSession.update({
        where: { id },
        data: { leaseToken: token, leaseUntil: new Date(Date.now() + 600_000) },
      })
    },
    { maxWait: 15000, timeout: 20000 }
  )
  try {
    return await action(session)
  } catch (error) {
    await db.videoUploadSession.update({
      where: { id },
      data: {
        lastError:
          error instanceof PlatformError ? error.code : "R2_OPERATION_FAILED",
      },
    })
    return safeR2Error(error)
  } finally {
    await db.videoUploadSession.updateMany({
      where: { id, leaseToken: token },
      data: { leaseToken: null, leaseUntil: null },
    })
  }
}
const operate = operateVideoUpload
async function initializeVideoUpload(actorId: string, id: string) {
  return operate(id, actorId, async (session) => {
    if (session.status !== "INITIALIZING") return
    const providerUploadId = await r2.initialize(session, id)
    await getPrisma().videoUploadSession.update({
      where: { id },
      data: { providerUploadId, status: "UPLOADING", lastError: null },
    })
  })
}
function multipart(session: VideoUploadSession) {
  if (!session.providerUploadId)
    throw new PlatformError(
      409,
      "UPLOAD_NOT_READY",
      "Retry upload initialization first."
    )
  return { ...session, providerUploadId: session.providerUploadId }
}
export async function reconcileVideoUpload(actorId: string, id: string) {
  const db = getPrisma()
  const initial = await db.videoUploadSession.findUnique({ where: { id } })
  if (
    initial &&
    [
      "COMPLETED",
      "PROCESSING",
      "PROCESSING_FAILED",
      "CANCELLING",
      "CANCELLED",
    ].includes(initial.status)
  ) {
    await contentAccess(db, actorId, initial.contentId)
    return { ...summary(initial), parts: [] }
  }
  if (initial?.status === "INITIALIZING")
    await initializeVideoUpload(actorId, id)
  return operate(id, actorId, async (session) => {
    if (
      [
        "COMPLETED",
        "PROCESSING",
        "PROCESSING_FAILED",
        "CANCELLING",
        "CANCELLED",
      ].includes(session.status)
    )
      return { ...summary(session), parts: [] }
    if (session.status !== "UPLOADING")
      throw new PlatformError(
        409,
        "UPLOAD_NOT_ACTIVE",
        "This upload must be completed or cancelled before continuing."
      )
    const parts = await r2.parts(multipart(session))
    const checksums = await db.videoUploadPart.findMany({
      where: { sessionId: id },
    })
    const verified = parts.filter(
      (part) =>
        part.size === partBytes(Number(session.fileSize), part.partNumber) &&
        checksums.some(
          (p) =>
            p.partNumber === part.partNumber &&
            p.md5 === part.etag.replaceAll('"', "").toLowerCase()
        )
    )
    return {
      ...summary(session),
      parts: verified.map((p) => ({
        partNumber: p.partNumber,
        bytes: p.size,
        md5: p.etag.replaceAll('"', "").toLowerCase(),
      })),
    }
  })
}
export async function signVideoPart(actorId: string, id: string, raw: unknown) {
  const input = signVideoPartSchema.parse(raw),
    db = getPrisma()
  const session = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
      const session = await tx.videoUploadSession.findUnique({ where: { id } })
      if (!session)
        throw new PlatformError(
          404,
          "UPLOAD_NOT_FOUND",
          "Upload session was not found."
        )
      await contentAccess(tx, actorId, session.contentId, true)
      if (
        session.status !== "UPLOADING" ||
        session.expiresAt.getTime() <= Date.now()
      )
        throw new PlatformError(
          409,
          "UPLOAD_NOT_ACTIVE",
          "Resume an active upload before transferring parts."
        )
      if (!partBytes(Number(session.fileSize), input.partNumber))
        throw new PlatformError(
          400,
          "INVALID_PART",
          "This part is outside the reserved file."
        )
      const previous = await tx.videoUploadPart.findUnique({
        where: {
          sessionId_partNumber: { sessionId: id, partNumber: input.partNumber },
        },
      })
      if (previous && previous.md5 !== input.md5)
        throw new PlatformError(
          409,
          "WRONG_FILE",
          "The selected file does not match the original upload."
        )
      await tx.videoUploadPart.upsert({
        where: {
          sessionId_partNumber: { sessionId: id, partNumber: input.partNumber },
        },
        create: { sessionId: id, ...input },
        update: {},
      })
      return session
    },
    { maxWait: 15000, timeout: 20000 }
  )
  try {
    return await r2.signPart(
      multipart(session),
      input.partNumber,
      input.md5,
      partBytes(Number(session.fileSize), input.partNumber)
    )
  } catch (error) {
    return safeR2Error(error)
  }
}
export async function completeVideoUpload(actorId: string, id: string) {
  return operate(id, actorId, async (session) => {
    const db = getPrisma()
    if (session.status === "COMPLETED") return summary(session)
    if (["PROCESSING", "CANCELLING"].includes(session.status))
      return summary(session)
    if (session.status === "PROCESSING_FAILED") {
      await assertVideoProcessorAvailable()
      return summary(
        await db.videoUploadSession.update({
          where: { id },
          data: { status: "PROCESSING", lastError: null },
        })
      )
    }
    if (!["UPLOADING", "COMPLETING"].includes(session.status))
      throw new PlatformError(
        409,
        "UPLOAD_NOT_ACTIVE",
        "This upload cannot be completed."
      )
    const savedParts = await db.videoUploadPart.findMany({
      where: { sessionId: id },
      orderBy: { partNumber: "asc" },
    })
    const count = Math.ceil(Number(session.fileSize) / VIDEO_PART_BYTES)
    if (
      savedParts.length !== count ||
      savedParts.some((p, i) => p.partNumber !== i + 1)
    )
      throw new PlatformError(
        409,
        "MISSING_PARTS",
        "Upload all file parts before completing."
      )
    let object = await r2.head(session)
    if (!object) {
      const parts = await r2.parts(multipart(session))
      if (
        parts.length !== count ||
        parts.some(
          (p, i) =>
            p.partNumber !== i + 1 ||
            p.size !== partBytes(Number(session.fileSize), p.partNumber) ||
            p.etag.replaceAll('"', "").toLowerCase() !== savedParts[i].md5
        )
      )
        throw new PlatformError(
          409,
          "INVALID_PARTS",
          "R2 could not verify every uploaded part. Resume and retry the missing parts."
        )
      await db.videoUploadSession.update({
        where: { id },
        data: { status: "COMPLETING" },
      })
      await r2.complete(multipart(session), parts)
      object = await r2.head(session)
    }
    const expectedEtag = `${createHash("md5")
      .update(Buffer.concat(savedParts.map((p) => Buffer.from(p.md5, "hex"))))
      .digest("hex")}-${count}`
    if (
      !object ||
      object.bytes !== Number(session.fileSize) ||
      object.contentType !== videoContentType(session.objectKey) ||
      object.sessionId !== id ||
      object.etag?.replaceAll('"', "").toLowerCase() !== expectedEtag
    )
      throw new PlatformError(
        422,
        "OBJECT_VERIFICATION_FAILED",
        "The completed video failed size or integrity validation. Cancel this upload and select the original video again."
      )
    const { inspectMp4Header } = await import("@/lib/video/inspect-mp4")
    let metadata: VideoMetadata | undefined
    try {
      if (videoContentType(session.objectKey) !== "video/mp4")
        throw new Error("PROCESSING_REQUIRED")
      metadata = inspectMp4Header(
        await r2.readHeader(
          session,
          Math.min(Number(session.fileSize), VIDEO_HEADER_BYTES)
        )
      )
    } catch {
      await assertVideoProcessorAvailable()
      return summary(
        await db.videoUploadSession.update({
          where: { id },
          data: { status: "PROCESSING", lastError: null },
        })
      )
    }
    return attachVideoUpload(
      session,
      {
        objectKey: session.objectKey,
        bytes: Number(session.fileSize),
        etag: object.etag!,
      },
      metadata
    )
  })
}

export async function attachVideoUpload(
  session: VideoUploadSession,
  object: { objectKey: string; bytes: number; etag: string },
  metadata: VideoMetadata | PreparedVideoMetadata
) {
  const db = getPrisma(),
    id = session.id,
    actorId = session.actorId
  const processed = object.objectKey !== session.objectKey
  const result = await db.$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
      const current = await tx.videoUploadSession.findUniqueOrThrow({
        where: { id },
      })
      if (
        current.status === "CANCELLING" ||
        current.leaseToken !== session.leaseToken
      )
        throw new PlatformError(
          409,
          "UPLOAD_BUSY",
          "Video processing was cancelled or its lease was lost."
        )
      await contentAccess(tx, actorId, session.contentId, true)
      if (
        session.episodeId &&
        !(await tx.episode.findFirst({
          where: {
            id: session.episodeId,
            season: { seriesId: session.contentId },
          },
        }))
      )
        throw new PlatformError(
          409,
          "DESTINATION_REMOVED",
          "The upload destination no longer exists. Cancel this upload."
        )
      const previous = await tx.videoAsset.findFirst({
        where: {
          sourceType: "MANAGED",
          ...(session.episodeId
            ? { episodeId: session.episodeId }
            : { contentId: session.contentId }),
        },
      })
      const stored = await tx.storedVideoObject.create({
        data: {
          id: randomUUID(),
          sessionId: id,
          endpoint: session.endpoint,
          bucket: session.bucket,
          objectKey: object.objectKey,
          bytes: BigInt(object.bytes),
          etag: object.etag,
          metadata,
        },
      })
      const assetData = {
        sourceType: "MANAGED" as const,
        playbackUrl: null,
        storedObjectId: stored.id,
        contentId: session.episodeId ? null : session.contentId,
        episodeId: session.episodeId,
        durationSeconds: Math.ceil(metadata.durationSeconds),
        licenseType: session.licenseType,
        isPlayable: false,
      }
      const asset = previous
        ? await tx.videoAsset.update({
            where: { id: previous.id },
            data: assetData,
          })
        : await tx.videoAsset.create({ data: assetData })
      if (previous?.storedObjectId)
        await tx.storedVideoObject.update({
          where: { id: previous.storedObjectId },
          data: { state: "PENDING_DELETE" },
        })
      await tx.videoStorageReservation.update({
        where: { sessionId: id },
        data: processed
          ? { bytes: session.fileSize }
          : { releasedAt: new Date() },
      })
      await tx.auditLog.create({
        data: {
          actorId,
          action: "COMPLETE_VIDEO_UPLOAD",
          entityType: "video-assets",
          entityId: asset.id,
        },
      })
      return tx.videoUploadSession.update({
        where: { id },
        data: {
          status: "COMPLETED",
          assetId: asset.id,
          lastError: null,
          sourceDeleted: !processed,
        },
      })
    },
    { maxWait: 15000, timeout: 20000 }
  )
  return summary(result)
}
export async function cancelVideoUpload(actorId: string | null, id: string) {
  const current = await getPrisma().videoUploadSession.findUnique({
    where: { id },
  })
  if (
    current &&
    ["PROCESSING", "CANCELLING"].includes(current.status) &&
    current.leaseUntil &&
    current.leaseUntil.getTime() > Date.now()
  ) {
    if (actorId) await contentAccess(getPrisma(), actorId, current.contentId)
    await getPrisma().videoUploadSession.updateMany({
      where: {
        id,
        status: { in: ["PROCESSING", "CANCELLING"] },
        leaseToken: current.leaseToken,
      },
      data: { status: "CANCELLING" },
    })
    return summary(
      await getPrisma().videoUploadSession.findUniqueOrThrow({ where: { id } })
    )
  }
  return operate(
    id,
    actorId,
    async (session) => {
      const db = getPrisma()
      if (["CANCELLED", "COMPLETED"].includes(session.status))
        return summary(session)
      await db.videoUploadSession.update({
        where: { id },
        data: { status: "CANCELLING" },
      })
      await r2.abort(session)
      await r2.delete(session)
      if (session.processingObjectKey) {
        const output = {
          ...session,
          objectKey: session.processingObjectKey,
          providerUploadId: null,
        }
        await r2.abort(output)
        await r2.delete(output)
      }
      return db.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
          await tx.videoStorageReservation.update({
            where: { sessionId: id },
            data: { releasedAt: new Date() },
          })
          return summary(
            await tx.videoUploadSession.update({
              where: { id },
              data: {
                status: "CANCELLED",
                lastError: null,
                sourceDeleted: true,
              },
            })
          )
        },
        { maxWait: 15000, timeout: 20000 }
      )
    },
    true
  )
}
export async function cleanupProcessedSource(id: string) {
  const db = getPrisma()
  const session = await db.videoUploadSession.findUniqueOrThrow({
    where: { id },
  })
  if (
    session.status !== "COMPLETED" ||
    !session.processingObjectKey ||
    session.sourceDeleted
  )
    return
  await r2.delete(session)
  await db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
    await tx.videoStorageReservation.update({
      where: { sessionId: id },
      data: { releasedAt: new Date() },
    })
    await tx.videoUploadSession.update({
      where: { id },
      data: { sourceDeleted: true, lastError: null },
    })
  })
}
export async function cleanupVideoStorage() {
  const expired = await getPrisma().videoUploadSession.findMany({
    where: {
      status: { notIn: ["CANCELLED", "COMPLETED"] },
      OR: [{ expiresAt: { lte: new Date() } }, { status: "CANCELLING" }],
    },
    take: 100,
  })
  let cancelled = 0
  for (const session of expired) {
    try {
      await cancelVideoUpload(null, session.id)
      cancelled++
    } catch {
      /* Reservation remains visible and retryable until provider confirmation. */
    }
  }
  const sources = await getPrisma().videoUploadSession.findMany({
    where: {
      status: "COMPLETED",
      processingObjectKey: { not: null },
      sourceDeleted: false,
    },
    select: { id: true },
    take: 100,
  })
  for (const source of sources) {
    try {
      await cleanupProcessedSource(source.id)
    } catch {
      await getPrisma().videoUploadSession.update({
        where: { id: source.id },
        data: { lastError: "SOURCE_CLEANUP_PENDING" },
      })
    }
  }
  const objects = await cleanupStoredObjects()
  return { expired: expired.length, cancelled, ...objects }
}
