import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { r2Configuration, r2 } from "@/lib/r2/provider"

export async function storageUsage(tx: Prisma.TransactionClient = getPrisma()) {
  const [stored, pending, reserved] = await Promise.all([
    tx.storedVideoObject.aggregate({
      where: { state: "READY" },
      _sum: { bytes: true },
    }),
    tx.storedVideoObject.aggregate({
      where: { state: "PENDING_DELETE" },
      _sum: { bytes: true },
    }),
    tx.videoStorageReservation.aggregate({
      where: { releasedAt: null },
      _sum: { bytes: true },
    }),
  ])
  const usage = {
    stored: Number(stored._sum.bytes ?? 0),
    pendingCleanup: Number(pending._sum.bytes ?? 0),
    reserved: Number(reserved._sum.bytes ?? 0),
  }
  const budget = r2Configuration().budget
  return {
    ...usage,
    budget,
    available: Math.max(
      0,
      budget - usage.stored - usage.pendingCleanup - usage.reserved
    ),
  }
}

// Run inside the existing mutation lock, before cascade deletion detaches assets.
export async function prepareMediaDeletion(
  tx: Prisma.TransactionClient,
  contentId: string,
  episodeIds?: string[]
) {
  const pending = await tx.videoUploadSession.count({
    where: {
      contentId,
      ...(episodeIds ? { episodeId: { in: episodeIds } } : {}),
      status: { notIn: ["COMPLETED", "CANCELLED"] },
    },
  })
  if (pending) {
    const { PlatformError } = await import("@/lib/platform-error")
    throw new PlatformError(
      409,
      "UPLOAD_IN_PROGRESS",
      "Cancel unfinished video uploads before deleting this destination."
    )
  }
  const assets = await tx.videoAsset.findMany({
    where: episodeIds
      ? { episodeId: { in: episodeIds } }
      : {
          OR: [{ contentId }, { episode: { season: { seriesId: contentId } } }],
        },
    select: { storedObjectId: true },
  })
  await tx.storedVideoObject.updateMany({
    where: {
      id: {
        in: assets.flatMap((a) => (a.storedObjectId ? [a.storedObjectId] : [])),
      },
      state: "READY",
    },
    data: { state: "PENDING_DELETE" },
  })
}
export async function cleanupStoredObjects() {
  const db = getPrisma()
  const ready = await db.storedVideoObject.findMany({
    where: { state: "READY" },
    take: 100,
    orderBy: { createdAt: "asc" },
  })
  for (const object of ready) {
    try {
      if (await r2.head(object)) continue
      await db.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
        const current = await tx.storedVideoObject.findUnique({
          where: { id: object.id },
        })
        if (current?.state !== "READY") return
        await tx.videoAsset.updateMany({
          where: { storedObjectId: object.id },
          data: { storedObjectId: null, isPlayable: false },
        })
        await tx.storedVideoObject.update({
          where: { id: object.id },
          data: { state: "PENDING_DELETE", lastError: "OBJECT_MISSING" },
        })
      })
    } catch {
      await db.storedVideoObject.update({
        where: { id: object.id },
        data: { lastError: "R2_RECONCILIATION_FAILED" },
      })
    }
  }
  // Detached records include cascaded deletions; never scan or delete unrelated bucket keys.
  await db.storedVideoObject.updateMany({
    where: { state: "READY", asset: null },
    data: { state: "PENDING_DELETE" },
  })
  const objects = await db.storedVideoObject.findMany({
    where: { state: "PENDING_DELETE", asset: null },
    take: 100,
  })
  let deleted = 0
  for (const object of objects) {
    try {
      await r2.delete(object)
      await db.storedVideoObject.updateMany({
        where: { id: object.id, state: "PENDING_DELETE", asset: null },
        data: { state: "DELETED", deletedAt: new Date(), lastError: null },
      })
      deleted++
    } catch {
      await db.storedVideoObject.update({
        where: { id: object.id },
        data: { lastError: "R2_DELETE_FAILED" },
      })
    }
  }
  return { attempted: objects.length, deleted }
}
