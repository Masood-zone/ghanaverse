import "server-only"
import { getPrisma } from "@/lib/prisma"
import { buildSeriesNavigation } from "@/lib/series"
export async function getSeriesViewingData(
  content: {
    id: string
    isPremium: boolean
    seasons: Parameters<typeof buildSeriesNavigation>[0]
  },
  profileId?: string,
  currentEpisodeId?: string
) {
  const progress = profileId
    ? await getPrisma().watchProgress.findMany({
        where: { profileId, episode: { season: { seriesId: content.id } } },
        orderBy: { lastWatchedAt: "desc" },
      })
    : []
  return buildSeriesNavigation(
    content.seasons,
    progress,
    currentEpisodeId,
    content.isPremium
  )
}
