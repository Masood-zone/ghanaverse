import { CreditType, ContentType, MediaRights, MetadataSource, PublicationStatus } from "@/generated/prisma/enums";
import { safeExternalUrl, safeRemoteImageUrl } from "@/lib/image-policy";

// The importer deliberately accepts the Prisma client as a structural boundary so it can run in CLI tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;
type RecordValue = Record<string, unknown>;
export type ImportOptions = { limit?: number; dryRun?: boolean; updateExisting?: boolean };
export type ImportReport = { scanned: number; valid: number; inserted: number; updated: number; skipped: number; failed: number; movies: number; series: number; genres: number; languages: number; people: number; seasons: number; episodes: number; imagesRetained: number; imagesRejected: number; watchLinks: number; trailers: number; reasons: Record<string, number> };

const emptyReport = (): ImportReport => ({ scanned: 0, valid: 0, inserted: 0, updated: 0, skipped: 0, failed: 0, movies: 0, series: 0, genres: 0, languages: 0, people: 0, seasons: 0, episodes: 0, imagesRetained: 0, imagesRejected: 0, watchLinks: 0, trailers: 0, reasons: {} });
const asRecord = (value: unknown): RecordValue | undefined => value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : undefined;
const text = (value: unknown) => typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
const values = (value: unknown) => Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : [];
const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const note = (report: ImportReport, reason: string) => { report.skipped += 1; report.reasons[reason] = (report.reasons[reason] ?? 0) + 1; };
function extractYouTubeVideoId(input: string) { const value = input.trim(); if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value; try { const url = new URL(value); const id = url.hostname === "youtu.be" ? url.pathname.slice(1) : (url.searchParams.get("v") ?? url.pathname.match(/\/(embed|shorts)\/([A-Za-z0-9_-]{11})/)?.[2]); return id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined; } catch { return undefined; } }

export function parseRuntimeToMinutes(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) return Math.round(value);
  const source = text(value).toLowerCase(); if (!source || /^(n\/?a|unknown|-)$/.test(source)) return null;
  const hours = Number(source.match(/(\d+(?:\.\d+)?)\s*h/)?.[1] ?? 0); const minutes = Number(source.match(/(\d+)\s*m/)?.[1] ?? 0);
  const total = Math.round(hours * 60 + minutes); return total > 0 ? total : /^\d+$/.test(source) ? Number(source) : null;
}
export function parseReleaseDate(value: unknown): Date | null { const source = text(value); if (!source) return null; const normalized = /^\d{4}$/.test(source) ? `${source}-01-01T00:00:00.000Z` : source; const date = new Date(normalized); return Number.isNaN(date.getTime()) ? null : date; }
export function getSourceRecords(input: unknown): RecordValue[] { if (Array.isArray(input)) return input.flatMap((item) => asRecord(item) ? [item as RecordValue] : []); const record = asRecord(input); for (const name of ["data", "items", "results", "content", "movies"]) { if (Array.isArray(record?.[name])) return getSourceRecords(record[name]); } return []; }
function slugFor(title: string, externalId: string) { return `${key(title).slice(0, 70) || "title"}-${key(externalId).slice(0, 24) || "source"}`; }
function sourceType(value: unknown): ContentType | undefined { const source = text(value).toLowerCase(); return source === "movie" ? ContentType.MOVIE : ["tv_show", "tv show", "series"].includes(source) ? ContentType.SERIES : source === "documentary" ? ContentType.DOCUMENTARY : undefined; }
function normalizedNames(value: unknown) { return values(value).flatMap((item) => { const row = asRecord(item); const name = text(row?.name ?? item); return name ? [{ name, image: row?.image, character: text(row?.character) || undefined }] : []; }); }
function image(value: unknown, report: ImportReport) { const raw = text(value); if (!raw) return undefined; const valid = safeRemoteImageUrl(raw); if (valid) report.imagesRetained += 1; else report.imagesRejected += 1; return valid; }
function externalLinks(value: unknown) { return values(value).flatMap((entry) => { const row = asRecord(entry); const url = safeExternalUrl(row?.url ?? entry); return url ? [{ url, service: text(row?.service) || "External", type: text(row?.type) || undefined }] : []; }); }
async function namedId(db: Db, model: "genre" | "language", name: string, report: ImportReport) { const clean = text(name); if (!clean) return undefined; const slug = key(clean); const existing = await db[model].findFirst({ where: { name: { equals: clean, mode: "insensitive" } } }); if (existing) return existing.id; const created = await db[model].create({ data: model === "genre" ? { name: clean, slug } : { name: clean, code: slug.slice(0, 12) } }); report[model === "genre" ? "genres" : "languages"] += 1; return created.id; }
async function personId(db: Db, item: { name: string; image?: unknown }, report: ImportReport) { const existing = await db.person.findFirst({ where: { name: { equals: item.name, mode: "insensitive" } } }); const imageUrl = image(item.image, report); if (existing) { if (!existing.imageUrl && imageUrl) await db.person.update({ where: { id: existing.id }, data: { imageUrl } }); return existing.id; } const created = await db.person.create({ data: { name: item.name, imageUrl } }); report.people += 1; return created.id; }

export async function importGHMoviesDB(db: Db, input: unknown, options: ImportOptions = {}): Promise<ImportReport> {
  const report = emptyReport(); const limit = Math.min(Math.max(options.limit ?? 35, 1), 50);
  for (const record of getSourceRecords(input)) {
    if (report.valid >= limit) break; report.scanned += 1;
    const externalId = text(record.id); const title = text(record.title); const type = sourceType(record.type);
    if (!externalId || !title || !type || /\btest movie\w*\b/i.test(title)) { note(report, !externalId ? "missing-id" : !title ? "missing-title" : !type ? "unsupported-type" : "test-record"); continue; }
    report.valid += 1;
    const existing = await db.content.findFirst({ where: { metadataSource: MetadataSource.GH_MOVIES_DB, externalId } });
    if (existing && !options.updateExisting) { note(report, "existing"); continue; }
    if (options.dryRun) {
      report.inserted += existing ? 0 : 1; report.updated += existing ? 1 : 0;
      report.movies += type === ContentType.MOVIE ? 1 : 0; report.series += type === ContentType.SERIES ? 1 : 0;
      report.watchLinks += externalLinks(record.streamingLinks).length;
      report.trailers += extractYouTubeVideoId(text(record.trailerUrl)) ? 1 : 0;
      continue;
    }
    const releaseDate = parseReleaseDate(record.releaseDate); const genres = await Promise.all(values(record.genres).map((name) => namedId(db, "genre", text(name), report))); const languages = await Promise.all(values(record.languagesSpoken).map((name) => namedId(db, "language", text(name), report)));
    const trailerId = extractYouTubeVideoId(text(record.trailerUrl)); const links = externalLinks(record.streamingLinks); const posterUrl = image(record.posterImage, report); const backdropUrl = image(record.coverImage, report);
    const data = { title, slug: existing?.slug ?? slugFor(title, externalId), shortDescription: text(record.plotSummary).slice(0, 180) || "Catalogue metadata imported from Ghana Movie Database.", description: text(record.plotSummary) || "No synopsis was supplied by the source.", tagline: text(record.tagline) || null, releaseDate, releaseYear: releaseDate?.getUTCFullYear() ?? (Number.isInteger(record.releaseDate) ? Number(record.releaseDate) : null), country: text(record.country) || null, seriesStatus: text(record.status) || null, contentType: type, runtimeMinutes: parseRuntimeToMinutes(record.runtime), posterUrl, backdropUrl, metadataSource: MetadataSource.GH_MOVIES_DB, externalId, sourceReferenceUrl: safeExternalUrl(record.sourceUrl), tmdbId: Number.isInteger(record.tmdb_id) ? Number(record.tmdb_id) : null, imdbId: text(record.imdb_id) || null, sourceRating: typeof record.rating === "number" ? record.rating : Number(text(record.rating)) || null, sourcePayload: record, externalWatchLinks: links, mediaRights: MediaRights.UNKNOWN, publicationStatus: PublicationStatus.PUBLISHED, publishedAt: new Date() };
    try {
      const content = existing && options.updateExisting ? await db.content.update({ where: { id: existing.id }, data }) : await db.content.create({ data });
      await db.contentGenre.deleteMany({ where: { contentId: content.id } }); await db.contentLanguage.deleteMany({ where: { contentId: content.id } });
      await db.contentGenre.createMany({ data: genres.filter(Boolean).map((genreId) => ({ contentId: content.id, genreId: genreId! })), skipDuplicates: true }); await db.contentLanguage.createMany({ data: languages.filter(Boolean).map((languageId) => ({ contentId: content.id, languageId: languageId! })), skipDuplicates: true });
      for (const [role, names] of [[CreditType.CAST, normalizedNames(record.cast)], [CreditType.DIRECTOR, normalizedNames(record.directors)], [CreditType.WRITER, normalizedNames(record.writers)]] as const) for (const person of names) { const id = await personId(db, person, report); await db.contentCredit.upsert({ where: { contentId_personId_creditType: { contentId: content.id, personId: id, creditType: role } }, create: { contentId: content.id, personId: id, creditType: role, characterName: role === CreditType.CAST ? person.character : null }, update: { characterName: role === CreditType.CAST ? person.character : null } }); }
      if (trailerId) { await db.trailer.upsert({ where: { contentId: content.id }, create: { contentId: content.id, youtubeVideoId: trailerId }, update: { youtubeVideoId: trailerId } }); report.trailers += 1; }
      if (type === ContentType.SERIES) for (const seasonInput of values(record.seasons)) { const seasonRow = asRecord(seasonInput); const seasonNumber = Number(seasonRow?.seasonNumber); if (!Number.isInteger(seasonNumber) || seasonNumber < 1) continue; const season = await db.season.upsert({ where: { seriesId_seasonNumber: { seriesId: content.id, seasonNumber } }, create: { seriesId: content.id, seasonNumber, title: text(seasonRow?.title) || null, description: text(seasonRow?.description) || null }, update: { title: text(seasonRow?.title) || null, description: text(seasonRow?.description) || null } }); report.seasons += 1; for (const episodeInput of values(seasonRow?.episodes)) { const episode = asRecord(episodeInput); const episodeNumber = Number(episode?.episodeNumber); if (!Number.isInteger(episodeNumber) || episodeNumber < 1 || !text(episode?.title)) continue; await db.episode.upsert({ where: { seasonId_episodeNumber: { seasonId: season.id, episodeNumber } }, create: { seasonId: season.id, episodeNumber, title: text(episode?.title), description: text(episode?.plot) || null, runtimeMinutes: parseRuntimeToMinutes(episode?.runtime), airDate: parseReleaseDate(episode?.airDate) }, update: { title: text(episode?.title), description: text(episode?.plot) || null, runtimeMinutes: parseRuntimeToMinutes(episode?.runtime), airDate: parseReleaseDate(episode?.airDate) } }); report.episodes += 1; } }
      report.inserted += existing ? 0 : 1; report.updated += existing ? 1 : 0; report.movies += type === ContentType.MOVIE ? 1 : 0; report.series += type === ContentType.SERIES ? 1 : 0; report.watchLinks += links.length;
    } catch { report.failed += 1; }
  }
  return report;
}
