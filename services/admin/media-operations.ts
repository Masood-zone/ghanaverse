import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { PlatformError } from "@/lib/route-error"
type Context = {
  tx: Prisma.TransactionClient
  id: string
  child: string
  kind: string
  method: string
  raw: unknown
}
import {
  seasonSchema,
  episodeSchema,
  trailerSchema,
  videoAssetSchema,
} from "@/lib/platform-validation"
import { extractYouTubeVideoId } from "@/lib/youtube"
import { resolvePlaybackSource } from "@/lib/playback-source"
import { artwork, editable } from "./guards"
import { prepareMediaDeletion } from "@/services/video/storage"
export async function mutateMedia({
  tx,
  id,
  child,
  kind,
  method,
  raw,
}: Context) {
  let result: { id: string } | undefined

  let contentId: string | undefined
  let episodeId: string | undefined
  if (kind === "content") contentId = id
  else if (kind === "seasons") {
    contentId = (await tx.season.findUnique({ where: { id } }))?.seriesId
  } else if (kind === "episodes") {
    const episode = await tx.episode.findUnique({
      where: { id },
      include: { season: true },
    })
    contentId = episode?.season.seriesId
  } else if (kind === "video-assets") {
    const asset = await tx.videoAsset.findUnique({
      where: { id },
      include: { episode: { include: { season: true } } },
    })
    contentId = asset?.contentId ?? asset?.episode?.season.seriesId
  }
  if (!contentId)
    throw new PlatformError(404, "NOT_FOUND", "Parent title was not found")
  const parent = await editable(tx, contentId)
  if (kind === "content" && child === "trailer") {
    if (method === "DELETE") {
      await tx.trailer.deleteMany({ where: { contentId } })
      result = { id: contentId }
    } else {
      const input = trailerSchema.parse(raw)
      const videoId = extractYouTubeVideoId(input.video)
      if (!videoId)
        throw new PlatformError(
          400,
          "INVALID_TRAILER",
          "Use a valid YouTube video ID or URL"
        )
      const data = {
        youtubeVideoId: videoId,
        title: input.title,
        thumbnailUrl: await artwork(input.thumbnailUrl),
      }
      result = await tx.trailer.upsert({
        where: { contentId },
        create: { ...data, contentId },
        update: data,
      })
    }
  } else if (kind === "content" && child === "seasons") {
    if (parent.contentType !== "SERIES")
      throw new PlatformError(
        400,
        "SERIES_REQUIRED",
        "Seasons require a series"
      )
    const input = seasonSchema.parse(raw)
    if (
      await tx.season.findFirst({
        where: { seriesId: contentId, seasonNumber: input.seasonNumber },
      })
    )
      throw new PlatformError(
        409,
        "DUPLICATE_SEASON_NUMBER",
        `Season ${input.seasonNumber} already exists in this series. Choose another number.`
      )
    result = await tx.season.create({
      data: { ...input, seriesId: contentId },
    })
  } else if (kind === "seasons" && child === "episodes") {
    const input = episodeSchema.parse(raw)
    if (
      await tx.episode.findFirst({
        where: { seasonId: id, episodeNumber: input.episodeNumber },
      })
    )
      throw new PlatformError(
        409,
        "DUPLICATE_EPISODE_NUMBER",
        `Episode ${input.episodeNumber} already exists in this season. Choose another number.`
      )
    result = await tx.episode.create({
      data: {
        ...input,
        thumbnailUrl: await artwork(input.thumbnailUrl),
        airDate: input.airDate ? new Date(input.airDate) : null,
        seasonId: id,
      },
    })
  } else if (kind === "seasons") {
    if (method === "DELETE") {
      const episodes = await tx.episode.findMany({ where: { seasonId: id }, select: { id: true } })
      await prepareMediaDeletion(tx, contentId, episodes.map((e) => e.id))
    }
    if (method !== "DELETE") {
      const input = seasonSchema.parse(raw)
      if (
        await tx.season.findFirst({
          where: {
            seriesId: contentId,
            seasonNumber: input.seasonNumber,
            id: { not: id },
          },
        })
      )
        throw new PlatformError(
          409,
          "DUPLICATE_SEASON_NUMBER",
          `Season ${input.seasonNumber} already exists in this series. Choose another number.`
        )
    }
    result =
      method === "DELETE"
        ? await tx.season.delete({ where: { id } })
        : await tx.season.update({
            where: { id },
            data: seasonSchema.parse(raw),
          })
  } else if (kind === "episodes") {
    if (method === "DELETE") {
      await prepareMediaDeletion(tx, contentId, [id])
      result = await tx.episode.delete({ where: { id } })
    }
    else {
      const input = episodeSchema.parse(raw)
      const episode = await tx.episode.findUniqueOrThrow({ where: { id } })
      if (
        await tx.episode.findFirst({
          where: {
            seasonId: episode.seasonId,
            episodeNumber: input.episodeNumber,
            id: { not: id },
          },
        })
      )
        throw new PlatformError(
          409,
          "DUPLICATE_EPISODE_NUMBER",
          `Episode ${input.episodeNumber} already exists in this season. Choose another number.`
        )
      result = await tx.episode.update({
        where: { id },
        data: {
          ...input,
          airDate: input.airDate ? new Date(input.airDate) : null,
          thumbnailUrl: await artwork(input.thumbnailUrl),
        },
      })
    }
  } else if (
    (kind === "content" && child === "video-assets") ||
    kind === "video-assets"
  ) {
    if (method === "DELETE") {
      const asset = await tx.videoAsset.findUnique({ where: { id } })
      if (asset?.storedObjectId) await tx.storedVideoObject.update({ where: { id: asset.storedObjectId }, data: { state: "PENDING_DELETE" } })
      result = await tx.videoAsset.delete({ where: { id } })
    } else {
      const input = videoAssetSchema.parse(raw)
      if (kind === "video-assets" && (await tx.videoAsset.findUnique({ where: { id } }))?.sourceType === "MANAGED")
        throw new PlatformError(409, "MANAGED_UPLOAD_REQUIRED", "Use the video uploader to replace managed files, or the source selector to enable playback.")
      episodeId = input.episodeId ?? undefined
      if (
        episodeId &&
        !(await tx.episode.findFirst({
          where: { id: episodeId, season: { seriesId: contentId } },
        }))
      )
        throw new PlatformError(
          400,
          "EPISODE_OWNERSHIP",
          "Episode must belong to this title"
        )
      if (parent.contentType === "SERIES" && !episodeId)
        throw new PlatformError(
          400,
          "EPISODE_REQUIRED",
          "Attach series playback to an episode"
        )
      if (parent.contentType !== "SERIES" && episodeId)
        throw new PlatformError(
          400,
          "SERIES_REQUIRED",
          "Only series can have episode assets"
        )
      const source = resolvePlaybackSource(input.sourceType, input.playbackUrl)
      const playbackUrl = source?.url
      if (!source || !playbackUrl)
        throw new PlatformError(
          400,
          "INVALID_PLAYBACK",
          "Use a valid YouTube URL, HTTPS video-file URL, or local demo file"
        )
      if (source.kind === "youtube" && parent.isPremium)
        throw new PlatformError(
          400,
          "YOUTUBE_PREMIUM",
          "YouTube videos cannot be offered as paid playback."
        )
      if (parent.isPremium)
        throw new PlatformError(400, "PRIVATE_VIDEO_REQUIRED", "Upload a private managed video for premium content.")
      if (
        input.isPlayable &&
        ["UNKNOWN", "DEMO"].includes(input.licenseType) &&
        input.sourceType !== "DEMO"
      )
        throw new PlatformError(
          400,
          "RIGHTS_REQUIRED",
          "Record playback rights before enabling remote media"
        )
      const data = {
        ...input,
        sourceType:
          source.kind === "youtube" ? ("YOUTUBE" as const) : input.sourceType,
        playbackUrl,
        contentId: episodeId ? null : contentId,
        episodeId: episodeId ?? null,
      }
      if (input.isPlayable) await tx.videoAsset.updateMany({ where: episodeId ? { episodeId } : { contentId }, data: { isPlayable: false } })
      result =
        kind === "video-assets"
          ? await tx.videoAsset.update({ where: { id }, data })
          : await tx.videoAsset.create({ data })
    }
  }

  return result
}
