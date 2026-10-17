import { z } from "zod"
export const mobileMoneyProviders = {
  mtn: "mtn",
  telecel: "vod",
  at: "atl",
} as const
export const ghanaMobilePhone = z
  .string()
  .trim()
  .max(30)
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^(?:0|\+233)[25]\d{8}$/,
        "Enter a valid Ghanaian Mobile Money number, such as 024 123 4567 or +233 24 123 4567."
      )
  )
export const checkoutSchema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("card"), idempotencyKey: z.uuid() }).strict(),
  z
    .object({
      channel: z.literal("mobile_money"),
      idempotencyKey: z.uuid(),
      mobileMoneyNetwork: z.enum(["mtn", "telecel", "at"]),
      payerPhone: ghanaMobilePhone,
    })
    .strict(),
])
export const planSchema = z
  .object({
    amount: z.number().int().min(100).max(1000000),
    enabled: z.boolean(),
    commercialConfirmed: z.boolean(),
  })
  .strict()
export const licenseSchema = z
  .object({
    contentId: z.string().min(1),
    rightsHolderId: z.string().min(1),
    amount: z.number().int().min(1).max(100000000),
    startsAt: z.iso.datetime(),
    endsAt: z.iso.datetime(),
    dueAt: z.iso.datetime(),
    contractReference: z.string().trim().min(3).max(500),
    commercialUse: z.literal(true),
  })
  .strict()
  .refine((v) => Date.parse(v.endsAt) > Date.parse(v.startsAt), {
    path: ["endsAt"],
    message: "Licence end must be after its start.",
  })
export const recipientSchema = z
  .object({
    rightsHolderId: z.string().min(1),
    type: z.enum(["ghipss", "mobile_money"]),
    name: z.string().trim().min(2).max(150),
    bankCode: z.string().regex(/^[A-Za-z0-9_-]{2,20}$/),
    accountNumber: z
      .string()
      .regex(
        /^\+?[0-9]{7,20}$/,
        "Enter the bank account or Mobile Money number."
      ),
  })
  .strict()
export const payoutSchema = z
  .object({ licenseId: z.string().min(1), recipientId: z.string().min(1) })
  .strict()
