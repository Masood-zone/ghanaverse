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
import { creatorSchema } from "@/lib/validation/admin"
import { artwork } from "./guards"
export async function mutateCreator({ tx, id, method, raw }: Context) {
  let result: { id: string } | undefined

  if (method === "DELETE") {
    if (await tx.contentCredit.count({ where: { personId: id } }))
      throw new PlatformError(
        409,
        "RECORD_IN_USE",
        "This creator is credited on a title"
      )
    result = await tx.person.delete({ where: { id } })
  } else {
    const input = creatorSchema.parse(raw)
    const data = { ...input, imageUrl: await artwork(input.imageUrl) }
    result = id
      ? await tx.person.update({ where: { id }, data })
      : await tx.person.create({ data })
  }

  return result
}
