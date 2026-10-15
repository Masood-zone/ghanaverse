import "server-only"
import { getPrisma } from "@/lib/prisma"
import { getActiveProfile } from "@/lib/profiles"
import { getLibraryData } from "@/lib/viewer-data"
import { isPermittedPlaybackAsset } from "@/lib/image-policy"
import type { LibraryData, LibraryTitle } from "@/types/viewer"
export async function getProfilesData(userId: string) {
  const [profiles, active] = await Promise.all([
    getPrisma().viewerProfile.findMany({
      where: { userId },
      select: { id: true, name: true, avatar: true },
      orderBy: { createdAt: "asc" },
    }),
    getActiveProfile(userId),
  ])
  return { profiles, activeId: active?.id }
}
type Title = Awaited<
  ReturnType<typeof getLibraryData>
>["watchlist"][number]["content"]
function libraryTitle(content: Title): LibraryTitle {
  return {
    id: content.id,
    slug: content.slug,
    title: content.title,
    shortDescription: content.shortDescription,
    contentType: content.contentType,
    releaseYear: content.releaseYear,
    runtimeMinutes: content.runtimeMinutes,
    classification: content.classification,
    posterUrl: content.posterUrl,
    backdropUrl: content.backdropUrl,
    sourceRating: content.sourceRating,
    isPremium: content.isPremium,
    genres: content.genres.map((g) => ({ genre: { name: g.genre.name } })),
    languages: content.languages.map((l) => ({
      language: { name: l.language.name },
    })),
    videoAssets: content.isPremium
      ? []
      : content.videoAssets
          .filter(isPermittedPlaybackAsset)
          .map((a) => ({
            id: a.id,
            sourceType: a.sourceType,
            isPlayable: true,
          })),
  }
}
export async function getViewerLibrary(userId: string): Promise<LibraryData> {
  const data = await getLibraryData(userId)
  return {
    profile: data.profile
      ? {
          id: data.profile.id,
          name: data.profile.name,
          avatar: data.profile.avatar,
        }
      : null,
    watchlist: data.watchlist.map((item) => ({
      id: item.id,
      content: libraryTitle(item.content),
    })),
    history: data.history.map((item) => ({
      id: item.id,
      positionSeconds: item.positionSeconds,
      durationSeconds: item.durationSeconds,
      completed: item.completed,
      lastWatchedAt: item.lastWatchedAt.toISOString(),
      content: item.content ? libraryTitle(item.content) : null,
      episode: item.episode
        ? {
            id: item.episode.id,
            title: item.episode.title,
            thumbnailUrl: item.episode.thumbnailUrl,
            videoAssets: item.episode.season.series.isPremium
              ? []
              : item.episode.videoAssets
                  .filter(isPermittedPlaybackAsset)
                  .map((a) => ({
                    id: a.id,
                    sourceType: a.sourceType,
                    isPlayable: true,
                  })),
            season: { series: libraryTitle(item.episode.season.series) },
          }
        : null,
    })),
  }
}
