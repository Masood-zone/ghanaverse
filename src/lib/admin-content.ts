import "server-only";

import { MetadataSource, PublicationStatus } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";
import { safeArtworkUrl } from "@/lib/image-policy";
import { contentMutationSchema, slugify } from "@/lib/platform-validation";
import { PlatformError } from "@/lib/route-error";

type ContentInput = ReturnType<typeof contentMutationSchema.parse>;

async function validatedInput(raw: unknown) {
  const input = contentMutationSchema.parse(raw);
  const posterUrl = input.posterUrl ? safeArtworkUrl(input.posterUrl) ?? null : null;
  const backdropUrl = input.backdropUrl ? safeArtworkUrl(input.backdropUrl) ?? null : null;
  if (input.posterUrl && !posterUrl || input.backdropUrl && !backdropUrl) throw new PlatformError(400, "INVALID_ARTWORK_URL", "Artwork must use a trusted HTTPS host or a local GhanaVerse image.");
  if (input.classification && !await getPrisma().classification.findUnique({ where: { name: input.classification } })) throw new PlatformError(400, "INVALID_CLASSIFICATION", "Choose a registered classification.");
  return { input, posterUrl, backdropUrl };
}

async function availableSlug(title: string, preferred?: string, excludeId?: string) {
  const base = preferred || slugify(title) || "untitled";
  for (let suffix = 0; suffix < 100; suffix += 1) {
    const slug = suffix ? `${base}-${suffix + 1}` : base;
    const existing = await getPrisma().content.findUnique({ where: { slug }, select: { id: true } });
    if (!existing || existing.id === excludeId) return slug;
  }
  throw new PlatformError(409, "SLUG_CONFLICT", "A unique content URL could not be generated.");
}

function scalarData(input: ContentInput, posterUrl: string | null, backdropUrl: string | null, slug: string) {
  return {
    slug, title: input.title, shortDescription: input.shortDescription, description: input.description,
    tagline: input.tagline, releaseYear: input.releaseYear, releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
    country: input.country, seriesStatus: input.contentType === "SERIES" ? input.seriesStatus : null,
    contentType: input.contentType, runtimeMinutes: input.contentType === "SERIES" ? null : input.runtimeMinutes,
    classification: input.classification, publicationStatus: input.publicationStatus,
    isFeatured: input.isFeatured, isPremium: input.isPremium, posterUrl, backdropUrl,
    mediaRights: input.mediaRights, attributionNotes: input.attributionNotes,
    productionCompanyId: input.productionCompanyId, rightsHolderId: input.rightsHolderId,
    publishedAt: input.publicationStatus === PublicationStatus.PUBLISHED ? new Date() : null,
  };
}

export async function createContent(raw: unknown) {
  const { input, posterUrl, backdropUrl } = await validatedInput(raw);
  const slug = await availableSlug(input.title, input.slug);
  return getPrisma().content.create({ data: {
    ...scalarData(input, posterUrl, backdropUrl, slug), metadataSource: MetadataSource.MANUAL,
    genres: { create: input.genreIds.map((genreId) => ({ genreId })) },
    languages: { create: input.languageIds.map((languageId) => ({ languageId })) },
    credits: { create: input.credits.map((credit) => credit) },
  } });
}

export async function updateContent(id: string, raw: unknown) {
  const existing = await getPrisma().content.findUnique({ where: { id } });
  if (!existing) throw new PlatformError(404, "CONTENT_NOT_FOUND", "Content was not found.");
  const { input, posterUrl, backdropUrl } = await validatedInput(raw);
  const slug = await availableSlug(input.title, input.slug, id);
  return getPrisma().$transaction(async (tx) => {
    await Promise.all([
      tx.contentGenre.deleteMany({ where: { contentId: id } }),
      tx.contentLanguage.deleteMany({ where: { contentId: id } }),
      tx.contentCredit.deleteMany({ where: { contentId: id } }),
    ]);
    return tx.content.update({ where: { id }, data: {
      ...scalarData(input, posterUrl, backdropUrl, slug),
      publishedAt: input.publicationStatus === PublicationStatus.PUBLISHED ? existing.publishedAt ?? new Date() : null,
      genres: { create: input.genreIds.map((genreId) => ({ genreId })) },
      languages: { create: input.languageIds.map((languageId) => ({ languageId })) },
      credits: { create: input.credits.map((credit) => credit) },
    } });
  });
}
