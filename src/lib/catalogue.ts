import "server-only";
import { PublicationStatus } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";

export const catalogueInclude = { genres: { include: { genre: true } }, languages: { include: { language: true } }, trailer: true, productionCompany: true, credits: { include: { person: true } }, seasons: { include: { episodes: true } }, videoAssets: true } as const;

export async function getPublishedContent(options?: { q?: string; type?: string; genre?: string; language?: string }) {
  const { q, type, genre, language } = options ?? {};
  return getPrisma().content.findMany({ where: { publicationStatus: PublicationStatus.PUBLISHED, ...(type ? { contentType: type as never } : {}), ...(genre ? { genres: { some: { genre: { slug: genre } } } } : {}), ...(language ? { languages: { some: { language: { code: language } } } } : {}), ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { shortDescription: { contains: q, mode: "insensitive" } }, { description: { contains: q, mode: "insensitive" } }] } : {}) }, include: catalogueInclude, orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }] });
}

export async function getPublishedContentBySlug(slug: string) { return getPrisma().content.findFirst({ where: { slug, publicationStatus: PublicationStatus.PUBLISHED }, include: catalogueInclude }); }
export async function getCatalogueFacets() { const prisma = getPrisma(); return Promise.all([prisma.genre.findMany({ orderBy: { name: "asc" } }), prisma.language.findMany({ orderBy: { name: "asc" } })]); }
