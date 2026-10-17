import "server-only"
import { getPrisma } from "@/lib/prisma"
import { buildSeriesNavigation } from "@/lib/series"
import { getOptionalUser } from "@/lib/auth/access"
import { premiumAccess, activeLicense } from "@/services/billing/access"
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
  const user = content.isPremium ? await getOptionalUser() : null
  const allowed =
    !content.isPremium ||
    ((await premiumAccess(user?.user.id)).active &&
      Boolean(
        await getPrisma()
          .content.findUnique({
            where: { id: content.id },
            select: { rightsHolderId: true },
          })
          .then((c) => activeLicense(content.id, c?.rightsHolderId ?? null))
      ))
  return buildSeriesNavigation(
    content.isPremium
      ? content.seasons.map((s) => ({
          ...s,
          episodes: s.episodes.map((e) => ({
            ...e,
            videoAssets: e.videoAssets.filter(
              (a) => a.sourceType === "MANAGED"
            ),
          })),
        }))
      : content.seasons,
    progress,
    currentEpisodeId,
    !allowed
  )
}
