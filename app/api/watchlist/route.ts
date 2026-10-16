import { PublicationStatus } from "@/app/generated/prisma/enums"
import { apiSuccess } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/access"
import { getPrisma } from "@/lib/prisma"
import { watchlistSchema } from "@/lib/platform-validation"
import { requireActiveProfile } from "@/lib/profiles"
import { PlatformError, routeError } from "@/lib/route-error"
import { canViewContent, viewerContentWhere } from "@/lib/viewer-policy"
import { verifyOrigin } from "@/lib/viewer-photos"

async function context(request: Request) {
  const { user } = await requireUser()
  verifyOrigin(request)
  const { contentId, profileId } = watchlistSchema.parse(await request.json())
  const profile = await requireActiveProfile(user.id, profileId)
  const content = await getPrisma().content.findFirst({
    where: { id: contentId, publicationStatus: PublicationStatus.PUBLISHED },
  })
  if (!content)
    throw new PlatformError(
      404,
      "CONTENT_NOT_FOUND",
      "Published content was not found."
    )
  if (!canViewContent(profile, content))
    throw new PlatformError(
      403,
      "PROFILE_CONTENT_RESTRICTED",
      "This title is not available in Kids mode. Switch to a regular profile to continue."
    )
  return { profile, content }
}

export async function PUT(request: Request) {
  try {
    const { profile, content } = await context(request)
    const item = await getPrisma().watchlistItem.upsert({
      where: {
        profileId_contentId: { profileId: profile.id, contentId: content.id },
      },
      update: {},
      create: { profileId: profile.id, contentId: content.id },
    })
    return apiSuccess(item, "Added to My List.")
  } catch (error) {
    return routeError(error, "My List could not be updated.")
  }
}

export async function DELETE(request: Request) {
  try {
    const { profile, content } = await context(request)
    await getPrisma().watchlistItem.deleteMany({
      where: { profileId: profile.id, contentId: content.id },
    })
    return apiSuccess({ contentId: content.id }, "Removed from My List.")
  } catch (error) {
    return routeError(error, "My List could not be updated.")
  }
}

export async function GET(request: Request) {
  try {
    const { user } = await requireUser()
    const profile = await requireActiveProfile(user.id)
    const params = new URL(request.url).searchParams
    if (params.get("profileId") && params.get("profileId") !== profile.id)
      throw new PlatformError(
        409,
        "PROFILE_CHANGED",
        "Your active profile changed. Reload this page."
      )
    if (!params.has("contentId")) {
      const items = await getPrisma().watchlistItem.findMany({
        where: {
          profileId: profile.id,
          content: {
            publicationStatus: PublicationStatus.PUBLISHED,
            ...viewerContentWhere(profile),
          },
        },
        select: { contentId: true },
      })
      return apiSuccess({
        profileId: profile.id,
        contentIds: items.map((item) => item.contentId),
      })
    }
    const { contentId } = watchlistSchema.parse({
      contentId: new URL(request.url).searchParams.get("contentId"),
    })
    const saved = await getPrisma().watchlistItem.findFirst({
      where: {
        profileId: profile.id,
        contentId,
        content: {
          publicationStatus: PublicationStatus.PUBLISHED,
          ...viewerContentWhere(profile),
        },
      },
    })
    return apiSuccess({ saved: Boolean(saved) })
  } catch (error) {
    return routeError(error)
  }
}
