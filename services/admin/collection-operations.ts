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
import { collectionSchema } from "@/lib/validation/admin"
export async function mutateCollection({ tx, id, method, raw }: Context) {
  let result: { id: string } | undefined

  if (method === "DELETE")
    result = await tx.collection.delete({ where: { id } })
  else {
    const { contentIds, ...data } = collectionSchema.parse(raw)
    if (
      (await tx.content.count({ where: { id: { in: contentIds } } })) !==
      contentIds.length
    )
      throw new PlatformError(
        400,
        "INVALID_CONTENT",
        "A selected title no longer exists"
      )
    if (id) await tx.collectionItem.deleteMany({ where: { collectionId: id } })
    const items = {
      create: contentIds.map((contentId, sortOrder) => ({
        contentId,
        sortOrder,
      })),
    }
    result = id
      ? await tx.collection.update({
          where: { id },
          data: { ...data, items },
        })
      : await tx.collection.create({ data: { ...data, items } })
  }

  return result
}
