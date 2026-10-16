import "server-only"
import { getPrisma } from "@/lib/prisma"
import { PlatformError } from "@/lib/route-error"
export async function ownedPhoto(
  userId: string,
  assetId: string | null | undefined,
  purpose: "accountPhoto" | "profilePhoto"
) {
  if (assetId === undefined) return undefined
  if (assetId === null) return null
  const asset = await getPrisma().artworkAsset.findFirst({
    where: { id: assetId, uploadedById: userId, purpose },
  })
  if (!asset)
    throw new PlatformError(
      400,
      "INVALID_PHOTO",
      "Choose a photo uploaded for this account."
    )
  return asset.secureUrl
}
export function verifyOrigin(request: Request) {
  const origin = request.headers.get("origin")
  if (origin && origin !== new URL(request.url).origin)
    throw new PlatformError(
      403,
      "INVALID_ORIGIN",
      "Request origin is not permitted."
    )
}
