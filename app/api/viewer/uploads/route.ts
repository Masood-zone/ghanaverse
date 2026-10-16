import { z } from "zod"
import { requireUser } from "@/lib/auth/access"
import { apiSuccess } from "@/lib/api-response"
import { getPrisma } from "@/lib/prisma"
import { uploadArtwork } from "@/lib/cloudinary/cloudinary-service"
import { readUploadForm } from "@/lib/upload-form"
import { verifyOrigin } from "@/lib/viewer-photos"
import { requireOwnedProfile } from "@/lib/profiles"
import { PlatformError, routeError } from "@/lib/route-error"
export async function POST(request: Request) {
  try {
    const { user } = await requireUser()
    verifyOrigin(request)
    const form = await readUploadForm(request)
    const target = z.enum(["account", "profile"]).parse(form.get("target"))
    const profileId = form.get("profileId")
    if (profileId)
      await requireOwnedProfile(user.id, z.string().min(1).parse(profileId))
    const file = form.get("file")
    if (!(file instanceof File))
      throw new PlatformError(400, "FILE_REQUIRED", "Choose an image.")
    const upload = await uploadArtwork(
      file,
      target === "account" ? "accountPhoto" : "profilePhoto"
    )
    const asset = await getPrisma().artworkAsset.create({
      data: { ...upload, uploadedById: user.id },
    })
    return apiSuccess(
      { id: asset.id, secureUrl: asset.secureUrl },
      "Photo uploaded. Save your changes to apply it."
    )
  } catch (error) {
    return routeError(
      error,
      "Photo upload failed. Your previous photo has been kept."
    )
  }
}
