import "server-only"
import {
  contentMutationSchema,
  seasonSchema,
  episodeSchema,
  trailerSchema,
  videoAssetSchema,
  publicationSchema,
} from "@/lib/platform-validation"
import { getPrisma } from "@/lib/prisma"
import { apiSuccess } from "@/lib/api-response"
import { PlatformError, routeError } from "@/lib/route-error"
import { requireUser } from "@/lib/auth/access"
import {
  contentActor,
  contentAccess,
  mutationContentId,
  assertRequestOrigin,
} from "./access"
import { mutateContent } from "@/services/admin/content-operations"
import { mutateMedia } from "@/services/admin/media-operations"
import { editorInclude } from "@/services/admin/read-models"

const ownerContent = contentMutationSchema
  .omit({ isFeatured: true, isPremium: true })
  .strict()
const namedOption = { id: true, name: true } as const
export async function readCreator(url: URL, actorId: string) {
  const db = getPrisma()
  await contentActor(db, actorId)
  const memberships = await db.rightsHolderMembership.findMany({
    where: { userId: actorId },
    select: { rightsHolderId: true },
  })
  const ids = memberships.map((m) => m.rightsHolderId)
  const parts = url.pathname.split("/").filter(Boolean).slice(2)
  if (parts[0] === "options") {
    const [
      genres,
      languages,
      classifications,
      companies,
      people,
      rightsHolders,
    ] = await Promise.all([
      db.genre.findMany({ select: namedOption, orderBy: { name: "asc" } }),
      db.language.findMany({ select: namedOption, orderBy: { name: "asc" } }),
      db.classification.findMany({
        select: namedOption,
        orderBy: { name: "asc" },
      }),
      db.productionCompany.findMany({
        select: namedOption,
        orderBy: { name: "asc" },
      }),
      db.person.findMany({ select: namedOption, orderBy: { name: "asc" } }),
      db.rightsHolder.findMany({
        where: { id: { in: ids } },
        select: namedOption,
        orderBy: { name: "asc" },
      }),
    ])
    return {
      genres,
      languages,
      classifications,
      companies,
      people,
      rightsHolders,
    }
  }
  if (parts[0] !== "content")
    throw new PlatformError(404, "NOT_FOUND", "Unknown workspace resource.")
  if (parts[1]) {
    await contentAccess(db, actorId, parts[1])
    return db.content.findUniqueOrThrow({
      where: { id: parts[1] },
      include: editorInclude,
    })
  }
  const q = (url.searchParams.get("q") ?? "").slice(0, 120)
  const where = {
    rightsHolderId: { in: ids },
    ...(q ? { title: { contains: q, mode: "insensitive" as const } } : {}),
  }
  const page = Math.max(
    1,
    Math.min(100000, Number(url.searchParams.get("page")) || 1)
  )
  const [items, total] = await Promise.all([
    db.content.findMany({
      where,
      take: 20,
      skip: (page - 1) * 20,
      orderBy: { updatedAt: "desc" },
      include: { rightsHolder: { select: { name: true } } },
    }),
    db.content.count({ where }),
  ])
  return { items, total, page, totalPages: Math.max(1, Math.ceil(total / 20)) }
}
export async function mutateCreatorContent(
  url: URL,
  method: string,
  raw: unknown,
  actorId: string
) {
  const [kind, id, child] = url.pathname.split("/").filter(Boolean).slice(2)
  const allowed =
    kind === "content"
      ? !child ||
        ["publication", "seasons", "video-assets", "trailer"].includes(child)
      : kind === "seasons"
        ? !child || child === "episodes"
        : ["episodes", "video-assets"].includes(kind) && !child
  if (!allowed)
    throw new PlatformError(404, "NOT_FOUND", "Unknown workspace operation.")
  return getPrisma().$transaction(
    async (tx) => {
      await tx.$queryRaw`SELECT 1 FROM pg_advisory_xact_lock(714915)`
      await contentActor(tx, actorId)
      const parentId = await mutationContentId(tx, kind, id)
      const content = parentId
        ? await contentAccess(tx, actorId, parentId, child !== "publication")
        : null
      if (!content && !(kind === "content" && !id && method === "POST"))
        throw new PlatformError(404, "NOT_FOUND", "Title was not found.")
      let input = raw
      if (kind === "content" && !child && method !== "DELETE") {
        const parsed = ownerContent.parse(raw)
        if (
          !parsed.rightsHolderId ||
          !(await tx.rightsHolderMembership.findUnique({
            where: {
              userId_rightsHolderId: {
                userId: actorId,
                rightsHolderId: parsed.rightsHolderId,
              },
            },
          }))
        )
          throw new PlatformError(
            403,
            "ORGANIZATION_REQUIRED",
            "Choose one of your linked rights-holder organizations."
          )
        if (content && parsed.rightsHolderId !== content.rightsHolderId)
          throw new PlatformError(
            403,
            "PROTECTED_FIELD",
            "Ownership transfers require an administrator."
          )
        input = {
          ...parsed,
          isFeatured: content?.isFeatured ?? false,
          isPremium: content?.isPremium ?? false,
        }
      } else if (method !== "DELETE") {
        const schema =
          child === "publication"
            ? publicationSchema
            : child === "trailer"
              ? trailerSchema
              : child === "seasons" || (kind === "seasons" && !child)
                ? seasonSchema
                : kind === "episodes" || child === "episodes"
                  ? episodeSchema
                  : videoAssetSchema
        input = schema.strict().parse(raw)
      }
      const context = { tx, id, kind, child, method, raw: input }
      const result =
        kind === "content" && (!child || child === "publication")
          ? await mutateContent(context)
          : await mutateMedia(context)
      if (!result)
        throw new PlatformError(
          404,
          "NOT_FOUND",
          "Unknown workspace operation."
        )
      await tx.auditLog.create({
        data: {
          actorId,
          action: `CREATOR_${method}_${kind}${child ? "_" + child : ""}`,
          entityType: kind,
          entityId: result.id,
        },
      })
      return { id: result.id }
    },
    { maxWait: 15000, timeout: 20000 }
  )
}
export async function handleCreatorContent(request: Request) {
  try {
    const { user } = await requireUser()
    const url = new URL(request.url)
    if (request.method === "GET")
      return apiSuccess(await readCreator(url, user.id))
    assertRequestOrigin(request)
    return apiSuccess(
      await mutateCreatorContent(
        url,
        request.method,
        request.method === "DELETE" ? null : await request.json(),
        user.id
      )
    )
  } catch (error) {
    return routeError(error)
  }
}
