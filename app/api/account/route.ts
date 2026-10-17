import { apiSuccess } from "@/lib/api-response"
import { requireUser } from "@/lib/auth/access"
import { routeError } from "@/lib/route-error"
import { getProfilesData } from "@/services/viewer/operations"
import { getPrisma } from "@/lib/prisma"
import { z } from "zod"
import { ownedPhoto, verifyOrigin } from "@/lib/viewer-photos"
export async function GET() {
  try {
    const { user } = await requireUser()
    const contact = await getPrisma().user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        phone: true,
        phoneVerifiedAt: true,
        transactionalSmsConsent: true,
      },
    })
    return apiSuccess({
      id: user.id,
      name: user.name,
      email: user.email,
      image: user.image,
      role: user.role,
      ...contact,
      hasRightsHolderReports:
        user.role === "RIGHTS_HOLDER" &&
        Boolean(
          await getPrisma().rightsHolderMembership.count({
            where: { userId: user.id },
          })
        ),
      ...(await getProfilesData(user.id)),
    })
  } catch (error) {
    return routeError(error)
  }
}
export async function PATCH(request: Request) {
  try {
    const { user } = await requireUser()
    verifyOrigin(request)
    const input = z
      .object({
        name: z.string().trim().min(1).max(180),
        photoAssetId: z.string().min(1).nullable().optional(),
      })
      .strict()
      .parse(await request.json())
    const image = await ownedPhoto(user.id, input.photoAssetId, "accountPhoto")
    const saved = await getPrisma().user.update({
      where: { id: user.id },
      data: { name: input.name, ...(image !== undefined ? { image } : {}) },
      select: { id: true, name: true, image: true },
    })
    return apiSuccess(saved, "Account updated.")
  } catch (error) {
    return routeError(error, "Account could not be updated.")
  }
}
