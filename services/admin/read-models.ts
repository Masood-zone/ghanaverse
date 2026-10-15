import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { PlatformError } from "@/lib/route-error"
export const editorInclude = {
  genres: true,
  languages: true,
  credits: true,
  trailer: true,
  seasons: {
    orderBy: { seasonNumber: "asc" as const },
    include: {
      episodes: {
        orderBy: { episodeNumber: "asc" as const },
        include: { videoAssets: true },
      },
    },
  },
  videoAssets: true,
} as const
const listInclude = {
  rightsHolder: { select: { name: true } },
  _count: { select: { seasons: true } },
} as const
export async function readAdmin(url: URL) {
  const db = getPrisma()
  const parts = url.pathname.split("/").filter(Boolean).slice(2)
  const [kind, id] = parts
  const q = (url.searchParams.get("q") ?? "").slice(0, 120)
  const page = Math.max(
    1,
    Math.min(100000, Number(url.searchParams.get("page")) || 1)
  )
  const take = 20
  if (kind === "dashboard") {
    const [
      titles,
      published,
      drafts,
      unpublished,
      viewers,
      creators,
      recent,
      distribution,
      activity,
    ] = await Promise.all([
      db.content.count(),
      db.content.count({ where: { publicationStatus: "PUBLISHED" } }),
      db.content.count({ where: { publicationStatus: "DRAFT" } }),
      db.content.count({ where: { publicationStatus: "UNPUBLISHED" } }),
      db.user.count({ where: { role: "VIEWER" } }),
      db.person.count(),
      db.content.findMany({
        take: 6,
        orderBy: { createdAt: "desc" },
        include: listInclude,
      }),
      db.content.groupBy({ by: ["contentType"], _count: true }),
      db.auditLog.findMany({ take: 6, orderBy: { createdAt: "desc" } }),
    ])
    return {
      titles,
      published,
      drafts,
      unpublished,
      viewers,
      creators,
      recent,
      distribution,
      activity,
    }
  }
  if (kind === "content" && id) {
    const content = await db.content.findUnique({
      where: { id },
      include: editorInclude,
    })
    if (!content)
      throw new PlatformError(404, "NOT_FOUND", "Title was not found")
    return content
  }
  if (kind === "content") {
    const status = url.searchParams.get("status")
    const type = url.searchParams.get("type")
    const where: Prisma.ContentWhereInput = {
      ...(q ? { title: { contains: q, mode: "insensitive" } } : {}),
      ...(status && ["DRAFT", "PUBLISHED", "UNPUBLISHED"].includes(status)
        ? { publicationStatus: status as "DRAFT" | "PUBLISHED" | "UNPUBLISHED" }
        : {}),
      ...(type &&
      [
        "MOVIE",
        "SERIES",
        "DOCUMENTARY",
        "CULTURAL_PROGRAMME",
        "LIFESTYLE_PROGRAMME",
      ].includes(type)
        ? { contentType: type as Prisma.ContentWhereInput["contentType"] }
        : {}),
      ...(url.searchParams.get("genre")
        ? { genres: { some: { genreId: url.searchParams.get("genre")! } } }
        : {}),
    }
    const [items, total] = await Promise.all([
      db.content.findMany({
        where,
        include: listInclude,
        take,
        skip: (page - 1) * take,
        orderBy: { updatedAt: "desc" },
      }),
      db.content.count({ where }),
    ])
    return {
      items,
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / take)),
    }
  }
  if (kind === "options" || kind === "metadata") {
    const [
      genres,
      languages,
      classifications,
      companies,
      rightsHolders,
      people,
    ] = await Promise.all([
      db.genre.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { contents: true } } },
      }),
      db.language.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { contents: true } } },
      }),
      db.classification.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { contents: true } } },
      }),
      db.productionCompany.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { contents: true } } },
      }),
      db.rightsHolder.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { contents: true } } },
      }),
      db.person.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { credits: true } } },
      }),
    ])
    return {
      genres,
      languages,
      classifications,
      companies,
      rightsHolders,
      people,
    }
  }
  if (kind === "users") {
    const role = url.searchParams.get("role")
    const status = url.searchParams.get("status")
    const where: Prisma.UserWhereInput = {
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { email: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(role === "ADMIN" || role === "VIEWER" ? { role } : {}),
      ...(status === "active" || status === "suspended"
        ? { isSuspended: status === "suspended" }
        : {}),
    }
    const [items, total, admins, viewers, suspended] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          isSuspended: true,
          createdAt: true,
          _count: { select: { profiles: true } },
        },
        take,
        skip: (page - 1) * take,
        orderBy: { createdAt: "desc" },
      }),
      db.user.count({ where }),
      db.user.count({ where: { role: "ADMIN", isSuspended: false } }),
      db.user.count({ where: { role: "VIEWER" } }),
      db.user.count({ where: { isSuspended: true } }),
    ])
    return {
      items,
      total,
      admins,
      viewers,
      suspended,
      page,
      totalPages: Math.max(1, Math.ceil(total / take)),
    }
  }
  if (kind === "creators")
    return db.person.findMany({
      where: q ? { name: { contains: q, mode: "insensitive" } } : {},
      orderBy: { name: "asc" },
      include: { _count: { select: { credits: true } } },
    })
  if (kind === "collections")
    return db.collection.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: {
        items: {
          orderBy: { sortOrder: "asc" },
          include: {
            content: {
              select: { id: true, title: true, publicationStatus: true },
            },
          },
        },
      },
    })
  if (kind === "activity") {
    const where = q
      ? {
          OR: [
            { action: { contains: q, mode: "insensitive" as const } },
            { entityId: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}
    const [items, total] = await Promise.all([
      db.auditLog.findMany({
        where,
        take,
        skip: (page - 1) * take,
        orderBy: { createdAt: "desc" },
      }),
      db.auditLog.count({ where }),
    ])
    const actors = await db.user.findMany({
      where: { id: { in: [...new Set(items.map((i) => i.actorId))] } },
      select: { id: true, name: true },
    })
    return {
      items: items.map((i) => ({
        ...i,
        actorName:
          actors.find((a) => a.id === i.actorId)?.name ??
          "Former administrator",
      })),
      total,
      page,
      totalPages: Math.max(1, Math.ceil(total / take)),
    }
  }
  throw new PlatformError(404, "NOT_FOUND", "Unknown administration resource")
}
