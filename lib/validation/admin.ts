import { z } from "zod"
import { UserRole } from "@/app/generated/prisma/enums"
export const userUpdateSchema = z.object({
  role: z.enum(UserRole),
  isSuspended: z.boolean(),
})
export const creatorSchema = z.object({
  name: z.string().trim().min(1).max(180),
  imageUrl: z.string().max(2000).nullable().optional(),
})
export const collectionSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().max(1000).nullable().optional(),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0),
  contentIds: z
    .array(z.string().min(1))
    .max(100)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Choose each title once"
    ),
})
export function publicationIssues(content: {
  title: string
  shortDescription: string
  description: string
  classification: string | null
  posterUrl: string | null
  productionCompanyId: string | null
  genres: unknown[]
  languages: unknown[]
  credits: unknown[]
}) {
  const issues: string[] = []
  if (
    !content.title.trim() ||
    !content.shortDescription.trim() ||
    !content.description.trim()
  )
    issues.push("Complete title and descriptions")
  if (!content.classification) issues.push("Choose an audience classification")
  if (!content.posterUrl) issues.push("Add poster artwork")
  if (!content.genres.length || !content.languages.length)
    issues.push("Choose at least one genre and language")
  if (!content.credits.length && !content.productionCompanyId)
    issues.push("Credit a creator or production company")
  return issues
}
