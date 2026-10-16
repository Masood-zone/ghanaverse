import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import type { z } from "zod"
import { getPrisma, sqlTable } from "@/lib/prisma"
import { PlatformError } from "@/lib/route-error"
import { isPermittedPlaybackAsset } from "@/lib/image-policy"
import {
  mergeCoverage,
  coverageSeconds,
  type WatchedRange,
} from "@/lib/playback-metrics"
import { playbackSessionSchema } from "@/lib/validation/playback"
import { canViewContent } from "@/lib/viewer-policy"
import type { sessionTelemetrySchema } from "@/lib/validation/playback"

export async function permittedAsset(id: string) {
  const asset = await getPrisma().videoAsset.findUnique({
    where: { id },
    include: {
      content: true,
      episode: { include: { season: { include: { series: true } } } },
    },
  })
  const content = asset?.content ?? asset?.episode?.season.series
  if (!asset || !content || content.publicationStatus !== "PUBLISHED")
    throw new PlatformError(
      404,
      "VIDEO_NOT_FOUND",
      "Playable media was not found."
    )
  if (content.isPremium || !isPermittedPlaybackAsset(asset))
    throw new PlatformError(
      403,
      "PLAYBACK_NOT_PERMITTED",
      "Playback is not available for this title."
    )
  return { asset, content }
}

export async function startPlaybackSession(
  userId: string,
  profileId: string,
  raw: unknown
) {
  const input = playbackSessionSchema.parse(raw)
  const { asset, content } = await permittedAsset(input.videoAssetId)
  const profile = await getPrisma().viewerProfile.findFirst({
    where: { id: profileId, userId },
  })
  if (!profile)
    throw new PlatformError(
      403,
      "PROFILE_NOT_OWNED",
      "Viewer profile is not available."
    )
  if (!canViewContent(profile, content))
    throw new PlatformError(
      403,
      "PROFILE_CONTENT_RESTRICTED",
      "This title is not available in Kids mode."
    )
  const session = await getPrisma().playbackSession.upsert({
    where: { idempotencyKey: input.idempotencyKey },
    // A nonempty update lets PostgreSQL perform an atomic ON CONFLICT upsert.
    update: { idempotencyKey: input.idempotencyKey },
    create: {
      ...input,
      userId,
      profileId,
      contentId: content.id,
      episodeId: asset.episodeId,
      durationSeconds: asset.durationSeconds,
    },
  })
  if (
    session.userId !== userId ||
    session.profileId !== profileId ||
    session.videoAssetId !== asset.id
  )
    throw new PlatformError(
      403,
      "SESSION_NOT_OWNED",
      "Viewing session is not available."
    )
  return { id: session.id }
}

export async function recordPlaybackSample(
  tx: Prisma.TransactionClient,
  userId: string,
  profileId: string,
  assetId: string,
  telemetry: z.infer<typeof sessionTelemetrySchema>,
  duration?: number | null
) {
  await tx.$queryRaw`SELECT "id" FROM ${sqlTable("PlaybackSession")} WHERE "id" = ${telemetry.sessionId} FOR UPDATE`
  const session = await tx.playbackSession.findUnique({
    where: { id: telemetry.sessionId },
  })
  if (
    !session ||
    session.userId !== userId ||
    session.profileId !== profileId ||
    session.videoAssetId !== assetId
  )
    throw new PlatformError(
      403,
      "SESSION_NOT_OWNED",
      "Viewing session is not available."
    )
  if (telemetry.sequence <= session.lastSequence) return false
  if (telemetry.watchedMilliseconds < session.reportedMilliseconds)
    throw new PlatformError(
      400,
      "INVALID_TELEMETRY",
      "Viewing time cannot move backwards."
    )
  const now = new Date()
  const elapsed = now.getTime() - session.lastSampleAt.getTime()
  if (now.getTime() - session.startedAt.getTime() > 86_400_000)
    throw new PlatformError(
      409,
      "SESSION_EXPIRED",
      "Reopen this video to start a new viewing session."
    )
  const watchedMilliseconds = Math.max(
    0,
    Math.min(
      telemetry.watchedMilliseconds - session.reportedMilliseconds,
      elapsed + 1000,
      now.getTime() -
        session.startedAt.getTime() -
        session.watchedMilliseconds +
        1000
    )
  )
  const total = session.watchedMilliseconds + watchedMilliseconds
  const length =
    duration && Number.isFinite(duration) && duration > 0 && duration <= 86400
      ? duration
      : session.durationSeconds
  const coverage = mergeCoverage(
    [...(session.coverage as WatchedRange[]), ...telemetry.coverage],
    length ?? 86400
  )
  if (coverageSeconds(coverage) > (total / 1000) * 4 + 2)
    throw new PlatformError(
      400,
      "INVALID_COVERAGE",
      "Watched coverage exceeds active playback time."
    )
  await tx.playbackSample.create({
    data: {
      sessionId: session.id,
      sequence: telemetry.sequence,
      watchedMilliseconds,
      createdAt: now,
    },
  })
  await tx.playbackSession.update({
    where: { id: session.id },
    data: {
      lastSequence: telemetry.sequence,
      lastSampleAt: now,
      reportedMilliseconds: telemetry.watchedMilliseconds,
      watchedMilliseconds: total,
      coverage,
      durationSeconds: length,
      completedAt:
        session.completedAt ??
        (length && coverageSeconds(coverage) / length >= 0.9 ? now : null),
    },
  })
  return true
}
