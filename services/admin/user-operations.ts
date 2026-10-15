import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { PlatformError } from "@/lib/route-error"
type Context = {
  tx: Prisma.TransactionClient
  id: string
  child: string
  kind: string
  method: string
  raw: unknown
}
import { userUpdateSchema } from "@/lib/validation/admin"
export async function mutateUser({ tx, id, raw }: Context) {
  const input = userUpdateSchema.parse(raw)
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
  const result = await tx.user.update({
    where: { id },
    data: input,
    select: { id: true },
  })

  return result
}
