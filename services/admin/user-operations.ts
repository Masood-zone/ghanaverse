import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { PlatformError } from "@/lib/route-error"
import { hashPassword } from "better-auth/crypto"
import { createRightsHolderUserSchema } from "@/lib/validation/rights-holders"
type Context = {
  tx: Prisma.TransactionClient
  id: string
  child: string
  kind: string
  method: string
  raw: unknown
}
import { userUpdateSchema } from "@/lib/validation/admin"
export async function mutateUser({ tx, id, raw, method }: Context) {
  if (method === "POST" && !id) {
    const input = createRightsHolderUserSchema.parse(raw)
    if (
      await tx.user.findFirst({
        where: { email: { equals: input.email, mode: "insensitive" } },
      })
    )
      throw new PlatformError(
        409,
        "EMAIL_IN_USE",
        "This email already has an account. Find it in Users and assign rights-holder access instead."
      )
    const holder = input.rightsHolderId
      ? await tx.rightsHolder.findUnique({
          where: { id: input.rightsHolderId },
        })
      : await tx.rightsHolder.create({
          data: {
            ...input.rightsHolder!,
            contactEmail: input.rightsHolder?.contactEmail || input.email,
          },
        })
    if (!holder)
      throw new PlatformError(
        400,
        "INVALID_RIGHTS_HOLDER",
        "Choose an existing rights holder"
      )
    const userId = crypto.randomUUID()
    return tx.user.create({
      data: {
        id: userId,
        name: input.name,
        email: input.email,
        role: "RIGHTS_HOLDER",
        accounts: {
          create: {
            id: crypto.randomUUID(),
            providerId: "credential",
            accountId: userId,
            password: await hashPassword(input.password),
          },
        },
        profiles: { create: { name: "My Profile", avatar: "adinkra" } },
        rightsHolderMemberships: { create: { rightsHolderId: holder.id } },
      },
      select: { id: true },
    })
  }
  const input = userUpdateSchema.parse(raw)
  const { rightsHolderIds, ...fields } = input
  const target = await tx.user.findUnique({ where: { id } })
  if (!target) throw new PlatformError(404, "NOT_FOUND", "User was not found")
  if (
    target.role === "ADMIN" &&
    !target.isSuspended &&
    (input.role !== "ADMIN" || input.isSuspended) &&
    (await tx.user.count({
      where: { role: "ADMIN", isSuspended: false },
    })) <= 1
  )
    throw new PlatformError(
      409,
      "LAST_ADMIN",
      "The last active administrator must remain active"
    )
  await tx.session.deleteMany({ where: { userId: id } })
  const memberships =
    fields.role === "RIGHTS_HOLDER" ? [...new Set(rightsHolderIds)] : []
  if (
    memberships.length !==
    (await tx.rightsHolder.count({ where: { id: { in: memberships } } }))
  )
    throw new PlatformError(
      400,
      "INVALID_RIGHTS_HOLDER",
      "Choose existing rights holders"
    )
  await tx.rightsHolderMembership.deleteMany({ where: { userId: id } })
  const result = await tx.user.update({
    where: { id },
    data: {
      ...fields,
      rightsHolderMemberships: {
        create: memberships.map((rightsHolderId) => ({ rightsHolderId })),
      },
    },
    select: { id: true },
  })

  return result
}
