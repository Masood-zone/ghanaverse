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
import { safePlaybackUrl } from "@/lib/image-policy"
import { artwork, editable } from "./guards"
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
    result = await tx.season.create({
      data: { ...seasonSchema.parse(raw), seriesId: contentId },
    })
  } else if (kind === "seasons" && child === "episodes") {
    const input = episodeSchema.parse(raw)
    result = await tx.episode.create({
      data: {
        ...input,
        thumbnailUrl: await artwork(input.thumbnailUrl),
        airDate: input.airDate ? new Date(input.airDate) : null,
        seasonId: id,
      },
    })
  } else if (kind === "seasons")
    result =
      method === "DELETE"
        ? await tx.season.delete({ where: { id } })
        : await tx.season.update({
            where: { id },
            data: seasonSchema.parse(raw),
          })
  else if (kind === "episodes") {
    if (method === "DELETE") result = await tx.episode.delete({ where: { id } })
    else {
      const input = episodeSchema.parse(raw)
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
    if (method === "DELETE")
      result = await tx.videoAsset.delete({ where: { id } })
    else {
      const input = videoAssetSchema.parse(raw)
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
      const playbackUrl = safePlaybackUrl(
        input.playbackUrl,
        input.sourceType === "DEMO"
      )
      if (!playbackUrl || input.sourceType === "MANAGED")
        throw new PlatformError(
          400,
          "INVALID_PLAYBACK",
          "Use an HTTPS remote URL or local demo file"
        )
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
        playbackUrl,
        contentId: episodeId ? null : contentId,
        episodeId: episodeId ?? null,
      }
      result =
        kind === "video-assets"
          ? await tx.videoAsset.update({ where: { id }, data })
          : await tx.videoAsset.create({ data })
    }
  }

  return result
}
