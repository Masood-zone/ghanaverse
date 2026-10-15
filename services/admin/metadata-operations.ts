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
import { metadataKindSchema, metadataSchemas } from "@/lib/platform-validation"
export async function mutateMetadata({ tx, id, child, method, raw }: Context) {
  let result: { id: string } | undefined

  const k = metadataKindSchema.parse(id)
  const recordId = child
  // Explicit branches retain each Prisma model's input types.
  if (method === "DELETE") {
    let count = 0
    if (k === "genres")
      count = await tx.contentGenre.count({
        where: { genreId: recordId },
      })
    else if (k === "languages")
      count = await tx.contentLanguage.count({
        where: { languageId: recordId },
      })
    else if (k === "classifications") {
      const r = await tx.classification.findUnique({
        where: { id: recordId },
      })
      count = r
        ? await tx.content.count({ where: { classification: r.name } })
        : 0
    } else
      count = await tx.content.count({
        where:
          k === "production-companies"
            ? { productionCompanyId: recordId }
            : { rightsHolderId: recordId },
      })
    if (count)
      throw new PlatformError(
        409,
        "RECORD_IN_USE",
        "Referenced records cannot be deleted"
      )
    if (k === "genres")
      result = await tx.genre.delete({ where: { id: recordId } })
    else if (k === "languages")
      result = await tx.language.delete({ where: { id: recordId } })
    else if (k === "classifications")
      result = await tx.classification.delete({ where: { id: recordId } })
    else if (k === "production-companies")
      result = await tx.productionCompany.delete({
        where: { id: recordId },
      })
    else result = await tx.rightsHolder.delete({ where: { id: recordId } })
  } else if (k === "genres") {
    const data = metadataSchemas.genres.parse(raw)
    result = recordId
      ? await tx.genre.update({ where: { id: recordId }, data })
      : await tx.genre.create({ data })
  } else if (k === "languages") {
    const data = metadataSchemas.languages.parse(raw)
    result = recordId
      ? await tx.language.update({ where: { id: recordId }, data })
      : await tx.language.create({ data })
  } else if (k === "classifications") {
    const data = metadataSchemas.classifications.parse(raw)
    result = recordId
      ? await tx.classification.update({ where: { id: recordId }, data })
      : await tx.classification.create({ data })
  } else if (k === "production-companies") {
    const data = metadataSchemas["production-companies"].parse(raw)
    result = recordId
      ? await tx.productionCompany.update({
          where: { id: recordId },
          data,
        })
      : await tx.productionCompany.create({ data })
  } else {
    const data = metadataSchemas["rights-holders"].parse(raw)
    result = recordId
      ? await tx.rightsHolder.update({ where: { id: recordId }, data })
      : await tx.rightsHolder.create({ data })
  }

  return result
}
