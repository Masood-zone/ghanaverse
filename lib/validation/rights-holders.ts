import { z } from "zod"
const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => value || null)
export const rightsHolderDetailsSchema = z.object({
  name: z.string().trim().min(1).max(180),
  contactEmail: z
    .email()
    .or(z.literal(""))
    .nullish()
    .transform((value) => value || null),
  phone: text(60),
  address: text(500),
  website: z
    .url()
    .refine(
      (value) => /^https?:\/\//.test(value),
      "Use an HTTP or HTTPS website"
    )
    .or(z.literal(""))
    .nullish()
    .transform((value) => value || null),
  notes: text(2000),
})
export const createRightsHolderUserSchema = z
  .object({
    name: z.string().trim().min(1).max(180),
    email: z.email().trim().toLowerCase(),
    password: z.string().min(8).max(128),
    rightsHolderId: z.string().min(1).nullish(),
    rightsHolder: rightsHolderDetailsSchema.optional(),
  })
  .refine(
    (value) => Boolean(value.rightsHolderId) !== Boolean(value.rightsHolder),
    {
      message: "Select an existing rights holder or enter a new business name",
      path: ["rightsHolderId"],
    }
  )
