import "server-only"
import { z } from "zod"
import { getPrisma } from "@/lib/prisma"
import { PlatformError } from "@/lib/route-error"
import { r2, safeR2Error } from "@/lib/r2/provider"
import { contentAccess } from "@/services/content/access"
import { permittedAsset } from "@/services/viewer/playback-operations"
import { getActiveProfile } from "@/lib/profiles"
import { canViewContent } from "@/lib/viewer-policy"
import { resolvePlaybackSource } from "@/lib/playback-source"

export async function playbackSource(
  actorId: string,
  assetId: string,
  raw: unknown
) {
  const { preview, profileId } = z
    .object({
      preview: z.boolean().default(false),
      profileId: z.string().min(1).optional(),
    })
    .strict()
    .parse(raw)
  const db = getPrisma()
  const asset = await db.videoAsset.findUnique({
    where: { id: assetId },
    include: { storedObject: true, episode: { include: { season: true } } },
  })
  if (!asset)
    throw new PlatformError(404, "VIDEO_NOT_FOUND", "Video was not found.")
  if (preview) {
    const contentId = asset.contentId ?? asset.episode?.season.seriesId
    if (!contentId)
      throw new PlatformError(404, "VIDEO_NOT_FOUND", "Video was not found.")
    await contentAccess(db, actorId, contentId)
  } else {
    const { content } = await permittedAsset(assetId)
    const profile = profileId
      ? await db.viewerProfile.findFirst({
          where: { id: profileId, userId: actorId },
        })
      : await getActiveProfile(actorId)
    if (!profile)
      throw new PlatformError(
        403,
        "PROFILE_REQUIRED",
        "Select a viewer profile before playback."
      )
    if (!canViewContent(profile, content))
      throw new PlatformError(
        403,
        "PROFILE_CONTENT_RESTRICTED",
        "This title is not available in Kids mode."
      )
  }
  if (asset.sourceType === "MANAGED") {
    if (!asset.storedObject || asset.storedObject.state !== "READY")
      throw new PlatformError(
        409,
        "VIDEO_NOT_READY",
        "This managed video is not ready for playback."
      )
    try {
      return { kind: "native", ...(await r2.playback(asset.storedObject)) }
    } catch (error) {
      return safeR2Error(error)
    }
  }
  const source = resolvePlaybackSource(asset.sourceType, asset.playbackUrl)
  if (!source)
    throw new PlatformError(
      409,
      "VIDEO_NOT_READY",
      "This source is not supported."
    )
  return { ...source, expiresAt: null }
}
export async function selectVideoAsset(
  actorId: string,
  assetId: string,
  raw: unknown
) {
  const { enabled } = z.object({ enabled: z.boolean() }).strict().parse(raw)
  return getPrisma().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
      const asset = await tx.videoAsset.findUnique({
        where: { id: assetId },
        include: { storedObject: true, episode: { include: { season: true } } },
      })
      const contentId = asset?.contentId ?? asset?.episode?.season.seriesId
      if (!asset || !contentId)
        throw new PlatformError(404, "VIDEO_NOT_FOUND", "Video was not found.")
      const content = await contentAccess(tx, actorId, contentId, true)
      if (
        enabled &&
        ["UNKNOWN", "DEMO"].includes(asset.licenseType) &&
        asset.sourceType !== "DEMO"
      )
        throw new PlatformError(
          400,
          "RIGHTS_REQUIRED",
          "Record valid media rights before enabling playback."
        )
      if (
        enabled &&
        (asset.sourceType === "MANAGED"
          ? asset.storedObject?.state !== "READY"
          : !resolvePlaybackSource(asset.sourceType, asset.playbackUrl))
      )
        throw new PlatformError(
          409,
          "VIDEO_NOT_READY",
          "This source is not ready for playback."
        )
      if (
        enabled &&
        content.isPremium &&
        resolvePlaybackSource(asset.sourceType, asset.playbackUrl)?.kind ===
          "youtube"
      )
        throw new PlatformError(
          400,
          "YOUTUBE_PREMIUM",
          "YouTube playback must remain free."
        )
      if (enabled)
        await tx.videoAsset.updateMany({
          where: asset.episodeId
            ? { episodeId: asset.episodeId }
            : { contentId },
          data: { isPlayable: false },
        })
      await tx.videoAsset.update({
        where: { id: assetId },
        data: { isPlayable: enabled },
      })
      await tx.auditLog.create({
        data: {
          actorId,
          action: enabled ? "ENABLE_VIDEO" : "DISABLE_VIDEO",
          entityType: "video-assets",
          entityId: assetId,
        },
      })
      return { id: assetId }
    },
    { maxWait: 15000, timeout: 20000 }
  )
}
