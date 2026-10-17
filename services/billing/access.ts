import "server-only"
import type { Prisma } from "@/app/generated/prisma/client"
import { getPrisma } from "@/lib/prisma"
import { paymentConfiguration } from "@/lib/paystack"
import { PlatformError } from "@/lib/platform-error"

export async function premiumAccess(userId?: string, now = new Date()) {
  const mode = paymentConfiguration().mode
  if (!userId || !mode) return { active: false, expiresAt: null, mode }
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    select: { isSuspended: true },
  })
  if (!user || user.isSuspended) return { active: false, expiresAt: null, mode }
  const grants = await getPrisma().premiumGrant.findMany({
    where: { userId, mode, revokedAt: null, endsAt: { gt: now } },
    orderBy: { startsAt: "asc" },
  })
  let end = now.getTime()
  for (const grant of grants) {
    if (grant.startsAt.getTime() > end) break
    end = Math.max(end, grant.endsAt.getTime())
  }
  return {
    active: end > now.getTime(),
    expiresAt: end > now.getTime() ? new Date(end).toISOString() : null,
    mode,
  }
}
export async function activeLicense(
  contentId: string,
  rightsHolderId: string | null,
  db: Prisma.TransactionClient = getPrisma(),
  now = new Date()
) {
  if (!rightsHolderId) return null
  return db.contentLicense.findFirst({
    where: {
      contentId,
      rightsHolderId,
      status: "APPROVED",
      commercialUse: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    orderBy: { endsAt: "desc" },
  })
}
export async function premiumCatalogueAccess(
  userId: string | undefined,
  contents: Array<{
    id: string
    isPremium: boolean
    rightsHolderId: string | null
  }>
) {
  const allowed = new Set<string>()
  const premium = contents.filter((c) => c.isPremium)
  if (!premium.length || !(await premiumAccess(userId)).active) return allowed
  const now = new Date()
  const licenses = await getPrisma().contentLicense.findMany({
    where: {
      contentId: { in: premium.map((c) => c.id) },
      status: "APPROVED",
      commercialUse: true,
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
  })
  for (const license of licenses)
    if (
      premium.some(
        (c) =>
          c.id === license.contentId &&
          c.rightsHolderId === license.rightsHolderId
      )
    )
      allowed.add(license.contentId)
  return allowed
}
export async function authorizePremium(
  userId: string | undefined,
  content: { id: string; isPremium: boolean; rightsHolderId: string | null },
  sourceType: string
) {
  if (!content.isPremium) return null
  const access = await premiumAccess(userId)
  if (!access.active || !access.expiresAt)
    throw new PlatformError(
      403,
      "PREMIUM_REQUIRED",
      "An active Premium Pass is required. Renew access from Plans."
    )
  if (sourceType !== "MANAGED")
    throw new PlatformError(
      403,
      "PRIVATE_VIDEO_REQUIRED",
      "Premium titles require private managed video."
    )
  const license = await activeLicense(content.id, content.rightsHolderId)
  if (!license)
    throw new PlatformError(
      403,
      "LICENSE_UNAVAILABLE",
      "This title is not currently available under an active licence."
    )
  return new Date(
    Math.min(Date.parse(access.expiresAt), license.endsAt.getTime())
  )
}
export async function assertPremiumPublication(
  db: Prisma.TransactionClient,
  content: { id: string; rightsHolderId: string | null }
) {
  if (!(await activeLicense(content.id, content.rightsHolderId, db)))
    throw new PlatformError(
      400,
      "LICENSE_REQUIRED",
      "Approve an active commercial licence before publishing premium content."
    )
  const assets = await db.videoAsset.findMany({
    where: {
      isPlayable: true,
      OR: [
        { contentId: content.id },
        { episode: { season: { seriesId: content.id } } },
      ],
    },
    include: { storedObject: { select: { state: true } } },
  })
  if (
    !assets.length ||
    assets.some(
      (a) => a.sourceType !== "MANAGED" || a.storedObject?.state !== "READY"
    )
  )
    throw new PlatformError(
      400,
      "PRIVATE_VIDEO_REQUIRED",
      "Premium publication requires ready, enabled private managed videos."
    )
}
