import { getProfilesData } from "@/services/viewer/operations"
import { cookies } from "next/headers"
import { apiSuccess } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/access"
import { getPrisma, sqlTable } from "@/lib/prisma"
import { ACTIVE_PROFILE_COOKIE, MAX_PROFILES } from "@/lib/profiles"
import { profileSchema } from "@/lib/platform-validation"
import { PlatformError, routeError } from "@/lib/route-error"
import { ownedPhoto, verifyOrigin } from "@/lib/viewer-photos"

export async function POST(request: Request) {
  try {
    const { user } = await requireUser()
    verifyOrigin(request)
    const { photoAssetId, ...input } = profileSchema.parse(await request.json())
    const image = await ownedPhoto(user.id, photoAssetId, "profilePhoto")
    const profile = await getPrisma().$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM ${sqlTable("User")} WHERE "id" = ${user.id} FOR UPDATE`
      if (
        (await tx.viewerProfile.count({ where: { userId: user.id } })) >=
        MAX_PROFILES
      )
        throw new PlatformError(
          409,
          "PROFILE_LIMIT_REACHED",
          `An account can have up to ${MAX_PROFILES} profiles.`
        )
      return tx.viewerProfile.create({
        data: { userId: user.id, ...input, image },
      })
    })
    ;(await cookies()).set(ACTIVE_PROFILE_COOKIE, profile.id, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    })
    return apiSuccess(profile, "Profile created.")
  } catch (error) {
    return routeError(error, "Profile could not be created.")
  }
}

export async function GET() {
  try {
    const { user } = await requireUser()
    return apiSuccess(await getProfilesData(user.id))
  } catch (error) {
    return routeError(error)
  }
}
