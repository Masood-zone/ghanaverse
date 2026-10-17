import "server-only"

import { PublicationStatus } from "@/app/generated/prisma/enums"
import {
  catalogueCardSelect,
  catalogueHeroSelect,
  restoreCatalogueDates,
  type CatalogueCard,
} from "@/lib/catalogue"
import { unstable_cache } from "next/cache"
import { CATALOGUE_TAG, COLLECTIONS_TAG } from "@/lib/catalogue-cache"
import { getViewerContext } from "@/lib/viewer-context"
import { viewerContentWhere } from "@/lib/viewer-policy"
import { getPrisma } from "@/lib/prisma"
import { getActiveProfile } from "@/lib/profiles"
import { rankRecommendations } from "@/lib/recommendations"

const assetSelect = {
  id: true,
  sourceType: true,
  playbackUrl: true,
  isPlayable: true,
  storedObject: { select: { state: true } },
} as const
export const libraryContentSelect = {
  ...catalogueCardSelect,
  backdropUrl: true,
  rightsHolderId: true,
  videoAssets: { select: assetSelect },
} as const
const progressInclude = {
  content: { select: libraryContentSelect },
  episode: {
    select: {
      id: true,
      title: true,
      thumbnailUrl: true,
      videoAssets: { select: assetSelect },
      season: { select: { series: { select: libraryContentSelect } } },
    },
  },
} as const

export const readHomeCatalogue = unstable_cache(
  async (isKids: boolean) => {
    const prisma = getPrisma()
    const eligible = {
      publicationStatus: PublicationStatus.PUBLISHED,
      ...viewerContentWhere({ isKids }),
    }
    const [content, heroes, collections] = await Promise.all([
      prisma.content.findMany({
        where: eligible,
        select: catalogueCardSelect,
        orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
        take: 48,
      }),
      prisma.content.findMany({
        where: eligible,
        select: catalogueHeroSelect,
        orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
        take: 8,
      }),
      prisma.collection.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        include: {
          items: {
            orderBy: { sortOrder: "asc" },
            where: {
              content: eligible,
            },
            take: 24,
            select: { content: { select: catalogueCardSelect } },
          },
        },
      }),
    ])
    const featured =
      heroes.find((item) => item.isFeatured && item.backdropUrl) ??
      heroes.find((item) => item.backdropUrl) ??
      heroes[0]
    return { content, heroes, collections, featured }
  },
  ["home-catalogue-v1"],
  { revalidate: 60, tags: [CATALOGUE_TAG, COLLECTIONS_TAG] }
)

export async function getHomeCatalogue(isKids: boolean) {
  const shared = await readHomeCatalogue(isKids)
  return {
    ...shared,
    content: shared.content.map(restoreCatalogueDates),
    heroes: shared.heroes.map(restoreCatalogueDates),
  }
}

export async function getHomeViewer(
  context: Awaited<ReturnType<typeof getViewerContext>>,
  content: CatalogueCard[]
) {
  const { access, profile } = context
  const prisma = getPrisma()
  if (!access) return null
  if (!profile)
    return { profile: null, watchlist: [], progress: [], recommendations: [] }
  const [watchlist, progress] = await Promise.all([
    prisma.watchlistItem.findMany({
      where: {
        profileId: profile.id,
        content: {
          publicationStatus: PublicationStatus.PUBLISHED,
          ...viewerContentWhere(profile),
        },
      },
      include: { content: { select: libraryContentSelect } },
      orderBy: { createdAt: "desc" },
      take: 16,
    }),
    prisma.watchProgress.findMany({
      where: {
        profileId: profile.id,
        positionSeconds: { gt: 0 },
        completed: false,
        OR: [
          {
            content: {
              publicationStatus: PublicationStatus.PUBLISHED,
              ...viewerContentWhere(profile),
            },
          },
          {
            episode: {
              season: {
                series: {
                  publicationStatus: PublicationStatus.PUBLISHED,
                  ...viewerContentWhere(profile),
                },
              },
            },
          },
        ],
      },
      include: progressInclude,
      orderBy: { lastWatchedAt: "desc" },
      take: 16,
    }),
  ])
  const sources = [
    ...progress
      .map((item) => item.content ?? item.episode?.season.series)
      .filter(Boolean),
    ...watchlist.map((item) => item.content),
  ]
    .slice(0, 10)
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
  const recommendations = rankRecommendations(content, sources).slice(0, 12)
  return {
    profile,
    watchlist,
    progress,
    recommendations,
  }
}

export async function getHomeData() {
  const context = await getViewerContext()
  const shared = await getHomeCatalogue(context.profile?.isKids ?? false)
  return { ...shared, viewer: await getHomeViewer(context, shared.content) }
}

export async function getLibraryData(userId: string) {
  const profile = await getActiveProfile(userId)
  if (!profile) return { profile: null, watchlist: [], history: [] }
  const prisma = getPrisma()
  const [watchlist, history] = await Promise.all([
    prisma.watchlistItem.findMany({
      where: {
        profileId: profile.id,
        content: {
          publicationStatus: PublicationStatus.PUBLISHED,
          ...viewerContentWhere(profile),
        },
      },
      include: { content: { select: libraryContentSelect } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.watchProgress.findMany({
      where: {
        profileId: profile.id,
        positionSeconds: { gt: 0 },
        OR: [
          {
            content: {
              publicationStatus: PublicationStatus.PUBLISHED,
              ...viewerContentWhere(profile),
            },
          },
          {
            episode: {
              season: {
                series: {
                  publicationStatus: PublicationStatus.PUBLISHED,
                  ...viewerContentWhere(profile),
                },
              },
            },
          },
        ],
      },
      include: progressInclude,
      orderBy: { lastWatchedAt: "desc" },
    }),
  ])
  return { profile, watchlist, history }
}
