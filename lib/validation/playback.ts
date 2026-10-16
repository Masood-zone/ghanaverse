import { z } from "zod"
export const playbackSessionSchema = z.object({
  videoAssetId: z.string().min(1),
  idempotencyKey: z.uuid(),
})
export const sessionTelemetrySchema = z.object({
  sessionId: z.string().min(1),
  sequence: z.number().int().positive().max(1_000_000),
  watchedMilliseconds: z.number().int().min(0).max(86_400_000),
  coverage: z
    .array(
      z
        .tuple([z.number().min(0).max(86400), z.number().min(0).max(86400)])
        .refine(([start, end]) => end >= start)
    )
    .max(1000),
})
