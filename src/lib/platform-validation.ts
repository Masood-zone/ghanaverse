import { z } from "zod";
import { ContentType, CreditType, MediaRights, PublicationStatus, VideoSourceType } from "@/generated/prisma/enums";

const optionalText = (max: number) => z.string().trim().max(max).optional().nullable().transform((value) => value || null);
const optionalId = z.string().trim().min(1).optional().nullable().transform((value) => value || null);

export const profileSchema = z.object({
  name: z.string().trim().min(1).max(40),
  avatar: z.enum(["adinkra", "kente", "coast", "savannah", "highlife", "market"]).optional().default("adinkra"),
});

export const profileSelectionSchema = z.object({ profileId: z.string().trim().min(1) });
export const watchlistSchema = z.object({ contentId: z.string().trim().min(1) });
export const progressSchema = z.object({
  videoAssetId: z.string().trim().min(1),
  positionSeconds: z.number().int().min(0),
  durationSeconds: z.number().int().positive().optional().nullable(),
  completed: z.boolean().optional().default(false),
});

export const creditSchema = z.object({
  personId: z.string().trim().min(1),
  creditType: z.enum(CreditType),
  characterName: optionalText(120),
});

export const contentMutationSchema = z.object({
  title: z.string().trim().min(1).max(180),
  slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(200).optional(),
  shortDescription: z.string().trim().min(1).max(280),
  description: z.string().trim().min(1).max(6000),
  tagline: optionalText(240),
  releaseYear: z.number().int().min(1890).max(2100).optional().nullable(),
  releaseDate: z.string().datetime().optional().nullable(),
  country: optionalText(80),
  seriesStatus: optionalText(80),
  contentType: z.enum(ContentType),
  runtimeMinutes: z.number().int().positive().max(1200).optional().nullable(),
  classification: optionalText(80),
  publicationStatus: z.enum(PublicationStatus).optional().default(PublicationStatus.DRAFT),
  isFeatured: z.boolean().optional().default(false),
  isPremium: z.boolean().optional().default(false),
  posterUrl: optionalText(2000),
  backdropUrl: optionalText(2000),
  mediaRights: z.enum(MediaRights).optional().default(MediaRights.UNKNOWN),
  attributionNotes: optionalText(2000),
  productionCompanyId: optionalId,
  rightsHolderId: optionalId,
  genreIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  languageIds: z.array(z.string().trim().min(1)).max(20).optional().default([]),
  credits: z.array(creditSchema).max(100).optional().default([]),
});

export const publicationSchema = z.object({ status: z.enum(PublicationStatus) });
export const trailerSchema = z.object({
  video: z.string().trim().min(1).max(500),
  title: optionalText(200),
  thumbnailUrl: optionalText(2000),
});
export const seasonSchema = z.object({ seasonNumber: z.number().int().positive().max(100), title: optionalText(180), description: optionalText(2000) });
export const episodeSchema = z.object({ episodeNumber: z.number().int().positive().max(1000), title: z.string().trim().min(1).max(180), description: optionalText(2000), runtimeMinutes: z.number().int().positive().max(1200).optional().nullable(), airDate: z.string().datetime().optional().nullable(), thumbnailUrl: optionalText(2000) });
export const videoAssetSchema = z.object({ sourceType: z.enum(VideoSourceType), playbackUrl: z.string().trim().min(1).max(2000), durationSeconds: z.number().int().positive().optional().nullable(), licenseType: z.enum(MediaRights), isPlayable: z.boolean().optional().default(false), episodeId: optionalId });

export const metadataKindSchema = z.enum(["genres", "languages", "classifications", "production-companies", "rights-holders"]);
export const metadataSchemas = {
  genres: z.object({ name: z.string().trim().min(1).max(100), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(120) }),
  languages: z.object({ name: z.string().trim().min(1).max(100), code: z.string().trim().min(2).max(12).toLowerCase() }),
  classifications: z.object({ name: z.string().trim().min(1).max(80), slug: z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100) }),
  "production-companies": z.object({ name: z.string().trim().min(1).max(180) }),
  "rights-holders": z.object({ name: z.string().trim().min(1).max(180), contactEmail: z.string().trim().email().optional().nullable().or(z.literal("")).transform((value) => value || null), notes: optionalText(2000) }),
} as const;

export function slugify(value: string) {
  return value.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
