import { cookies } from "next/headers"
import { apiSuccess } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/access"
import { getPrisma, sqlTable } from "@/lib/prisma"
import { ACTIVE_PROFILE_COOKIE, requireOwnedProfile } from "@/lib/profiles"
import { profileSchema } from "@/lib/platform-validation"
import { PlatformError, routeError } from "@/lib/route-error"
import { ownedPhoto, verifyOrigin } from "@/lib/viewer-photos"
const updateSchema = profileSchema.partial().extend({
  avatar: profileSchema.shape.avatar.removeDefault().optional(),
  isKids: profileSchema.shape.isKids.removeDefault().optional(),
  autoplayNextEpisode: profileSchema.shape.autoplayNextEpisode
    .removeDefault()
    .optional(),
  preferSubtitles: profileSchema.shape.preferSubtitles
    .removeDefault()
    .optional(),
})

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireUser()
    const { id } = await params
    await requireOwnedProfile(user.id, id)
    verifyOrigin(request)
    const { photoAssetId, ...input } = updateSchema.parse(await request.json())
    const image = await ownedPhoto(user.id, photoAssetId, "profilePhoto")
    const profile = await getPrisma().viewerProfile.update({
      where: { id },
      data: { ...input, ...(image !== undefined ? { image } : {}) },
    })
    return apiSuccess(profile, "Profile updated.")
  } catch (error) {
    return routeError(error, "Profile could not be updated.")
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireUser()
    const { id } = await params
    await requireOwnedProfile(user.id, id)
    verifyOrigin(request)
    await getPrisma().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM ${sqlTable("User")} WHERE "id" = ${user.id} FOR UPDATE`
      if ((await tx.viewerProfile.count({ where: { userId: user.id } })) <= 1)
        throw new PlatformError(
          409,
          "FINAL_PROFILE_REQUIRED",
          "An account must keep at least one viewer profile."
        )
      await tx.viewerProfile.delete({ where: { id } })
    })
    const cookieStore = await cookies()
    if (cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value === id)
      cookieStore.delete(ACTIVE_PROFILE_COOKIE)
    return apiSuccess({ id }, "Profile deleted.")
  } catch (error) {
    return routeError(error, "Profile could not be deleted.")
  }
}
