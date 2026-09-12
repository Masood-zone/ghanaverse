import "dotenv/config";
import { afterEach, describe, expect, it } from "vitest";
import { PublicationStatus, ContentType } from "@/generated/prisma/enums";
import { catalogueQuerySchema, getCataloguePage } from "@/lib/catalogue";
import { getPrisma } from "@/lib/prisma";
import { isPermittedPlaybackAsset, safeArtworkUrl } from "@/lib/image-policy";
import { rankRecommendations } from "@/lib/recommendations";
import { extractYouTubeVideoId } from "@/lib/youtube";

const ids: string[] = [];
afterEach(async () => { if (ids.length) await getPrisma().content.deleteMany({ where: { id: { in: ids.splice(0) } } }); });

describe("Phase 4 catalogue", () => {
  it("validates the complete URL query contract", () => {
    expect(catalogueQuerySchema.parse({ type: "MOVIE", sort: "title-asc", page: "2", pageSize: "48" })).toMatchObject({ type: "MOVIE", sort: "title-asc", page: 2, pageSize: 48 });
    expect(() => catalogueQuerySchema.parse({ pageSize: 49 })).toThrow();
  });

  it("excludes draft content from public catalogue queries", async () => {
    const suffix = crypto.randomUUID();
    const created = await getPrisma().content.createManyAndReturn({ data: [{ slug: `published-${suffix}`, title: `Published ${suffix}`, shortDescription: "Published content", description: "Published content", contentType: ContentType.MOVIE, publicationStatus: PublicationStatus.PUBLISHED, publishedAt: new Date() }, { slug: `draft-${suffix}`, title: `Draft ${suffix}`, shortDescription: "Draft content", description: "Draft content", contentType: ContentType.MOVIE, publicationStatus: PublicationStatus.DRAFT }] });
    ids.push(...created.map((item) => item.id));
    const result = await getCataloguePage({ q: suffix, pageSize: 48 });
    expect(result.items.map((item) => item.slug)).toEqual([`published-${suffix}`]);
  });

  it("loads ordered series relations", async () => {
    const suffix = crypto.randomUUID();
    const content = await getPrisma().content.create({ data: { slug: `series-${suffix}`, title: "Series Test", shortDescription: "Series content", description: "Series content", contentType: ContentType.SERIES, publicationStatus: PublicationStatus.PUBLISHED, publishedAt: new Date(), seasons: { create: { seasonNumber: 1, episodes: { create: [{ episodeNumber: 2, title: "Second" }, { episodeNumber: 1, title: "First" }] } } } } }); ids.push(content.id);
    const result = await getCataloguePage({ q: "Series Test", pageSize: 48 });
    expect(result.items.find((item) => item.id === content.id)?.seasons[0]?.episodes.map((episode) => episode.episodeNumber)).toEqual([1, 2]);
  });

  it("searches, filters, sorts, and paginates published records", async () => {
    const suffix = crypto.randomUUID();
    const created = await getPrisma().content.createManyAndReturn({ data: [
      { slug: `alpha-${suffix}`, title: `Alpha ${suffix}`, shortDescription: suffix, description: suffix, contentType: ContentType.MOVIE, publicationStatus: PublicationStatus.PUBLISHED, publishedAt: new Date("2025-01-01") },
      { slug: `zulu-${suffix}`, title: `Zulu ${suffix}`, shortDescription: suffix, description: suffix, contentType: ContentType.MOVIE, publicationStatus: PublicationStatus.PUBLISHED, publishedAt: new Date("2025-01-02") },
      { slug: `series-filter-${suffix}`, title: `Series ${suffix}`, shortDescription: suffix, description: suffix, contentType: ContentType.SERIES, publicationStatus: PublicationStatus.PUBLISHED, publishedAt: new Date("2025-01-03") },
    ] });
    ids.push(...created.map((item) => item.id));
    const first = await getCataloguePage({ q: suffix, type: ContentType.MOVIE, sort: "title-desc", pageSize: 1, page: 1 });
    const second = await getCataloguePage({ q: suffix, type: ContentType.MOVIE, sort: "title-desc", pageSize: 1, page: 2 });
    expect(first.pagination).toMatchObject({ total: 2, page: 1, totalPages: 2 });
    expect([first.items[0]?.slug, second.items[0]?.slug]).toEqual([`zulu-${suffix}`, `alpha-${suffix}`]);
  });
});

describe("Phase 4 recommendation and trailer rules", () => {
  const item = (id: string, genre: string, language: string, date: string) => ({ id, contentType: "MOVIE", publishedAt: new Date(date), genres: [{ genre: { id: genre } }], languages: [{ language: { id: language } }] });
  it("ranks deterministically and excludes source titles", () => { const source = item("source", "drama", "tw", "2025-01-01"); expect(rankRecommendations([item("weaker", "other", "tw", "2026-01-01"), item("stronger", "drama", "tw", "2024-01-01"), source], [source]).map(({ id }) => id)).toEqual(["stronger", "weaker"]); });
  it("extracts only valid YouTube IDs", () => { expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ"); expect(extractYouTubeVideoId("https://example.com/video")).toBeUndefined(); });
  it("accepts only trusted artwork and permitted playback sources", () => {
    expect(safeArtworkUrl("https://media.ghmoviesdb.com/posters/test.webp")).toContain("media.ghmoviesdb.com");
    expect(safeArtworkUrl("https://untrusted.example/poster.jpg")).toBeUndefined();
    expect(isPermittedPlaybackAsset({ sourceType: "DEMO", playbackUrl: "/media/demo.mp4", isPlayable: true })).toBe(true);
    expect(isPermittedPlaybackAsset({ sourceType: "REMOTE_URL", playbackUrl: "http://example.com/video.mp4", isPlayable: true })).toBe(false);
    expect(isPermittedPlaybackAsset({ sourceType: "MANAGED", playbackUrl: "https://example.com/video.mp4", isPlayable: true })).toBe(false);
  });
});
