import "server-only";

import { z } from "zod";
import { ContentType, PublicationStatus } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";

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
        include: { videoAssets: true },
      },
    },
  },
  videoAssets: true,
} as const;

export const catalogueQuerySchema = z.object({
  q: z.string().trim().max(120).optional().default(""),
  type: z.enum(ContentType).optional(),
  genre: z.string().trim().max(80).optional(),
  language: z.string().trim().max(24).optional(),
  classification: z.string().trim().max(80).optional(),
  sort: z.enum(["featured", "newest", "oldest", "title-asc", "title-desc"]).optional().default("featured"),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(48).optional().default(20),
});

export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>;
type QueryValues = Record<string, string | string[] | undefined> | URLSearchParams;

export function parseCatalogueQuery(values: QueryValues): CatalogueQuery {
  const get = (key: string) => {
    if (values instanceof URLSearchParams) return values.get(key) ?? undefined;
    const value = values[key];
    return Array.isArray(value) ? value[0] : value;
  };
  return catalogueQuerySchema.parse({
    q: get("q"), type: get("type") || undefined, genre: get("genre") || undefined,
    language: get("language") || undefined, classification: get("classification") || undefined,
    sort: get("sort") || undefined, page: get("page") || undefined, pageSize: get("pageSize") || undefined,
  });
}

function catalogueWhere(query: CatalogueQuery) {
  return {
    publicationStatus: PublicationStatus.PUBLISHED,
    ...(query.type ? { contentType: query.type } : {}),
    ...(query.genre ? { genres: { some: { genre: { slug: query.genre } } } } : {}),
    ...(query.language ? { languages: { some: { language: { code: query.language } } } } : {}),
    ...(query.classification ? { classificationRecord: { is: { slug: query.classification } } } : {}),
    ...(query.q ? { OR: [
      { title: { contains: query.q, mode: "insensitive" as const } },
      { shortDescription: { contains: query.q, mode: "insensitive" as const } },
      { description: { contains: query.q, mode: "insensitive" as const } },
      { credits: { some: { person: { name: { contains: query.q, mode: "insensitive" as const } } } } },
    ] } : {}),
  };
}

function catalogueOrder(sort: CatalogueQuery["sort"]) {
  if (sort === "newest") return [{ publishedAt: "desc" as const }, { id: "asc" as const }];
  if (sort === "oldest") return [{ publishedAt: "asc" as const }, { id: "asc" as const }];
  if (sort === "title-asc") return [{ title: "asc" as const }, { id: "asc" as const }];
  if (sort === "title-desc") return [{ title: "desc" as const }, { id: "asc" as const }];
  return [{ isFeatured: "desc" as const }, { publishedAt: "desc" as const }, { id: "asc" as const }];
}

export async function getCataloguePage(queryInput?: Partial<CatalogueQuery>) {
  const query = catalogueQuerySchema.parse(queryInput ?? {});
  const where = catalogueWhere(query);
  const prisma = getPrisma();
  const [items, total] = await Promise.all([
    prisma.content.findMany({ where, include: catalogueInclude, orderBy: catalogueOrder(query.sort), skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
    prisma.content.count({ where }),
  ]);
  return { items, pagination: { page: query.page, pageSize: query.pageSize, total, totalPages: Math.max(1, Math.ceil(total / query.pageSize)) }, query };
}

export async function getPublishedContent(options?: Partial<CatalogueQuery>) {
  return (await getCataloguePage({ pageSize: 48, ...options })).items;
}

export async function getPublishedContentBySlug(slug: string) {
  return getPrisma().content.findFirst({ where: { slug, publicationStatus: PublicationStatus.PUBLISHED }, include: catalogueInclude });
}

export async function getCatalogueFacets() {
  const prisma = getPrisma();
  const [genres, languages, classifications] = await Promise.all([
    prisma.genre.findMany({ orderBy: { name: "asc" } }),
    prisma.language.findMany({ orderBy: { name: "asc" } }),
    prisma.classification.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { genres, languages, classifications };
}
