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
import {
  contentMutationSchema,
  publicationSchema,
  slugify,
} from "@/lib/platform-validation"
import { publicationIssues } from "@/lib/validation/admin"
import { artwork, editable } from "./guards"
import { editorInclude } from "./read-models"
export async function mutateContent({ tx, id, child, method, raw }: Context) {
  let result: { id: string } | undefined
  if (!child) {
    if (id) await editable(tx, id)
    if (method === "DELETE") result = await tx.content.delete({ where: { id } })
    else {
      const input = contentMutationSchema.parse(raw)
      if (input.publicationStatus === "PUBLISHED")
        throw new PlatformError(
          409,
          "USE_PUBLICATION_ACTION",
          "Save a draft, then use Publish"
        )
      const {
        genreIds,
        languageIds,
        credits,
        posterUrl,
        backdropUrl,
        ...fields
      } = input
      if (
        input.classification &&
        !(await tx.classification.findUnique({
          where: { name: input.classification },
        }))
      )
        throw new PlatformError(
          400,
          "INVALID_CLASSIFICATION",
          "Choose a registered classification"
        )
      if (
        new Set(credits.map((c) => c.personId + ":" + c.creditType)).size !==
        credits.length
      )
        throw new PlatformError(
          400,
          "DUPLICATE_CREDIT",
          "Each creator role may only be credited once"
        )
      const existing = id
        ? await tx.content.findUnique({
            where: { id },
            include: {
              _count: { select: { seasons: true, videoAssets: true } },
            },
          })
        : null
      if (
        existing &&
        existing.contentType !== input.contentType &&
        (existing._count.seasons || existing._count.videoAssets)
      )
        throw new PlatformError(
          409,
          "CONTENT_TYPE_IN_USE",
          "Remove seasons and media before changing content format"
        )
      let slug = input.slug || slugify(input.title) || "untitled"
      let suffix = 1
      while (
        await tx.content.findFirst({
          where: { slug, ...(id ? { id: { not: id } } : {}) },
        })
      )
        slug = `${input.slug || slugify(input.title)}-${++suffix}`
      if (id) {
        await tx.contentGenre.deleteMany({ where: { contentId: id } })
        await tx.contentLanguage.deleteMany({ where: { contentId: id } })
        await tx.contentCredit.deleteMany({ where: { contentId: id } })
      }
      const data = {
        ...fields,
        slug,
        posterUrl: await artwork(posterUrl),
        backdropUrl: await artwork(backdropUrl),
        releaseDate: input.releaseDate ? new Date(input.releaseDate) : null,
        runtimeMinutes:
          input.contentType === "SERIES" ? null : input.runtimeMinutes,
        genres: {
          create: [...new Set(genreIds)].map((genreId) => ({ genreId })),
        },
        languages: {
          create: [...new Set(languageIds)].map((languageId) => ({
            languageId,
          })),
        },
        credits: { create: credits },
      }
      result = id
        ? await tx.content.update({ where: { id }, data })
        : await tx.content.create({ data })
    }
  } else {
    const { status } = publicationSchema.parse(raw)
    const content = await tx.content.findUnique({
      where: { id },
      include: editorInclude,
    })
    if (!content)
      throw new PlatformError(404, "NOT_FOUND", "Title was not found")
    if (status === "PUBLISHED") {
      const issues = publicationIssues(content)
      if (issues.length)
        throw new PlatformError(400, "NOT_READY", issues.join(". "))
    }
    result = await tx.content.update({
      where: { id },
      data: {
        publicationStatus: status,
        publishedAt:
          status === "PUBLISHED"
            ? (content.publishedAt ?? new Date())
            : content.publishedAt,
      },
    })
  }
  return result
}
