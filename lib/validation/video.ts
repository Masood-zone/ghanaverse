import { z } from "zod"
import { videoExtension } from "@/lib/video/constants"
export const videoMetadataSchema = z
  .object({
    durationSeconds: z.number().positive().max(86400),
    width: z.number().int().positive().max(8192),
    height: z.number().int().positive().max(8192),
    videoCodec: z.string().regex(/^avc[13]\./),
    audioCodecs: z.array(z.string().regex(/^mp4a\.40\.2$/)).max(8),
    progressive: z.literal(true),
  })
  .strict()
export const createVideoUploadSchema = z
  .object({
    idempotencyKey: z.uuid(),
    contentId: z.string().min(1),
    episodeId: z.string().min(1).nullable().default(null),
    filename: z
      .string()
      .min(1)
      .max(255)
      .refine(
        (name) => videoExtension(name) !== null,
        "Choose a supported video file."
      ),
    fileSize: z.number().int().positive().max(8_000_000_000),
    lastModified: z.number().nonnegative(),
    fingerprint: z.string().regex(/^[a-f0-9]{64}$/),
    licenseType: z.enum([
      "ORIGINAL",
      "LICENSED",
      "CREATIVE_COMMONS",
      "PUBLIC_DOMAIN",
    ]),
    mediaMetadata: videoMetadataSchema.nullable().default(null),
  })
  .strict()
export const signVideoPartSchema = z
  .object({
    partNumber: z.number().int().positive().max(500),
    md5: z.string().regex(/^[a-f0-9]{32}$/),
  })
  .strict()
export type VideoMetadata = z.infer<typeof videoMetadataSchema>
