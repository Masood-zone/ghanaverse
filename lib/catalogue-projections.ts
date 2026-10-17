import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
export const catalogueInclude = {
  genres: { include: { genre: true } },
  languages: { include: { language: true } },
  trailer: true,
  productionCompany: true,
  rightsHolder: true,
  credits: { include: { person: true } },
  seasons: {
    orderBy: { seasonNumber: "asc" as const },
    include: {
      episodes: {
        orderBy: { episodeNumber: "asc" as const },
        include: {
          videoAssets: {
            include: { storedObject: { select: { state: true } } },
          },
        },
      },
    },
  },
  videoAssets: { include: { storedObject: { select: { state: true } } } },
} as const

// Lists never load credits, seasons, episodes, rights-holder contacts, source
// payloads or private video objects. Detail/playback reads stay uncached.
export const catalogueCardSelect = {
  id: true,
  slug: true,
  title: true,
  shortDescription: true,
  contentType: true,
  releaseYear: true,
  runtimeMinutes: true,
  classification: true,
  posterUrl: true,
  sourceRating: true,
  isFeatured: true,
  isPremium: true,
  publishedAt: true,
  genres: {
    select: { genre: { select: { id: true, name: true, slug: true } } },
  },
  languages: {
    select: { language: { select: { id: true, name: true, code: true } } },
  },
} as const satisfies Prisma.ContentSelect

export const catalogueHeroSelect = {
  ...catalogueCardSelect,
  backdropUrl: true,
  trailer: { select: { youtubeVideoId: true } },
} as const satisfies Prisma.ContentSelect

export type CatalogueCard = Prisma.ContentGetPayload<{
  select: typeof catalogueCardSelect
}>
export type CatalogueHero = Prisma.ContentGetPayload<{
  select: typeof catalogueHeroSelect
}>

export function restoreCatalogueDates<
  T extends { publishedAt: Date | string | null },
>(item: T) {
  return {
    ...item,
    publishedAt: item.publishedAt ? new Date(item.publishedAt) : null,
  }
}
