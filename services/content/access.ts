import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { PlatformError } from "@/lib/platform-error"

export async function contentActor(
  tx: Prisma.TransactionClient,
  actorId: string
) {
  const user = await tx.user.findUnique({ where: { id: actorId } })
  if (!user || user.isSuspended)
    throw new PlatformError(
      401,
      "AUTH_REQUIRED",
      "Sign in with an active account."
    )
  if (user.role !== "ADMIN" && user.role !== "RIGHTS_HOLDER")
    throw new PlatformError(
      403,
      "CONTENT_ACCESS_REQUIRED",
      "Administrator or rights-holder access is required."
    )
  return user
}
export async function contentAccess(
  tx: Prisma.TransactionClient,
  actorId: string,
  id: string,
  editing = false
) {
  const user = await contentActor(tx, actorId)
  const content = await tx.content.findUnique({ where: { id } })
  const membership =
    content?.rightsHolderId && user.role === "RIGHTS_HOLDER"
      ? await tx.rightsHolderMembership.findUnique({
          where: {
            userId_rightsHolderId: {
              userId: actorId,
              rightsHolderId: content.rightsHolderId,
            },
          },
        })
      : null
  if (!content || (user.role !== "ADMIN" && !membership))
    throw new PlatformError(
      404,
      "CONTENT_NOT_FOUND",
      "This title is not available in your workspace."
    )
  if (editing && content.publicationStatus === "PUBLISHED")
    throw new PlatformError(
      409,
      "UNPUBLISH_REQUIRED",
      "Unpublish this title before changing its video or metadata."
    )
  return content
}
export async function mutationContentId(
  tx: Prisma.TransactionClient,
  kind: string,
  id: string
) {
  if (kind === "content") return id
  if (kind === "seasons")
    return (await tx.season.findUnique({ where: { id } }))?.seriesId
  if (kind === "episodes")
    return (
      await tx.episode.findUnique({ where: { id }, include: { season: true } })
    )?.season.seriesId
  if (kind === "video-assets") {
    const asset = await tx.videoAsset.findUnique({
      where: { id },
      include: { episode: { include: { season: true } } },
    })
    return asset?.contentId ?? asset?.episode?.season.seriesId
  }
}
export function assertRequestOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    throw new PlatformError(
      403,
      "INVALID_ORIGIN",
      "Request origin is not permitted."
    )
}
