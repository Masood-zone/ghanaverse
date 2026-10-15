export type RecommendationItem = {
  id: string;
  contentType: string;
  publishedAt: Date | null;
  genres: Array<{ genre: { id: string } }>;
  languages: Array<{ language: { id: string } }>;
};

export function rankRecommendations<T extends RecommendationItem>(candidates: T[], sources: RecommendationItem[]) {
  const sourceIds = new Set(sources.map((item) => item.id));
  const genreIds = new Set(sources.flatMap((item) => item.genres.map(({ genre }) => genre.id)));
  const languageIds = new Set(sources.flatMap((item) => item.languages.map(({ language }) => language.id)));
  const contentTypes = new Set(sources.map((item) => item.contentType));
  return candidates.filter((item) => !sourceIds.has(item.id)).map((item) => ({ item, score: item.genres.reduce((total, { genre }) => total + (genreIds.has(genre.id) ? 3 : 0), 0) + item.languages.reduce((total, { language }) => total + (languageIds.has(language.id) ? 2 : 0), 0) + (contentTypes.has(item.contentType) ? 1 : 0) })).sort((a, b) => b.score - a.score || (b.item.publishedAt?.getTime() ?? 0) - (a.item.publishedAt?.getTime() ?? 0) || a.item.id.localeCompare(b.item.id)).map(({ item }) => item);
}
