import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { PlatformError } from "@/lib/route-error"
import { safeArtworkUrl } from "@/lib/image-policy"
export async function editable(tx: Prisma.TransactionClient, id: string) {
  const content = await tx.content.findUnique({ where: { id } })
  if (!content) throw new PlatformError(404, "NOT_FOUND", "Title was not found")
  if (content.publicationStatus === "PUBLISHED")
    throw new PlatformError(
      409,
      "UNPUBLISH_REQUIRED",
      "Unpublish this title before editing it"
    )
  return content
}
export async function artwork(value: string | null | undefined) {
  if (value && !safeArtworkUrl(value))
    throw new PlatformError(
      400,
      "INVALID_ARTWORK_URL",
      "Choose trusted or uploaded artwork"
    )
  return value || null
}
