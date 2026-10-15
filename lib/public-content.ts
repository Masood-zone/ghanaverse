import type { getPublishedContentBySlug } from "@/lib/catalogue"
type Record = NonNullable<Awaited<ReturnType<typeof getPublishedContentBySlug>>>
export function publicContent(content: Record) {
  return {
    id: content.id,
    slug: content.slug,
    title: content.title,
    shortDescription: content.shortDescription,
    description: content.description,
    tagline: content.tagline,
    contentType: content.contentType,
    releaseYear: content.releaseYear,
    releaseDate: content.releaseDate,
    country: content.country,
    classification: content.classification,
    runtimeMinutes: content.runtimeMinutes,
    posterUrl: content.posterUrl,
    backdropUrl: content.backdropUrl,
    isFeatured: content.isFeatured,
    isPremium: content.isPremium,
    publishedAt: content.publishedAt,
    genres: content.genres.map((g) => ({
      id: g.genre.id,
      name: g.genre.name,
      slug: g.genre.slug,
    })),
    languages: content.languages.map((l) => ({
      id: l.language.id,
      name: l.language.name,
      code: l.language.code,
    })),
    productionCompany: content.productionCompany
      ? { name: content.productionCompany.name }
      : null,
    credits: content.credits.map((c) => ({
      personId: c.personId,
      creditType: c.creditType,
      characterName: c.characterName,
      person: { name: c.person.name, imageUrl: c.person.imageUrl },
    })),
    trailer: content.trailer
      ? {
          youtubeVideoId: content.trailer.youtubeVideoId,
          title: content.trailer.title,
        }
      : null,
    seasons: content.seasons.map((s) => ({
      id: s.id,
      seasonNumber: s.seasonNumber,
      title: s.title,
      description: s.description,
      episodes: s.episodes.map((e) => ({
        id: e.id,
        episodeNumber: e.episodeNumber,
        title: e.title,
        description: e.description,
        thumbnailUrl: e.thumbnailUrl,
        runtimeMinutes: e.runtimeMinutes,
      })),
    })),
  }
}
