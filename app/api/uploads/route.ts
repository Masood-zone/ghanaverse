import { requireUser } from "@/lib/auth/access"
import { contentAccess, contentActor } from "@/services/content/access"
import { getPrisma } from "@/lib/prisma"
import { apiSuccess } from "@/lib/api-response"
import { PlatformError, routeError } from "@/lib/route-error"
import { uploadArtwork } from "@/lib/cloudinary/cloudinary-service"
import { MAX_ARTWORK_BYTES } from "@/lib/validation/uploads"
export async function POST(request: Request) {
  try {
    const { user } = await requireUser()
    await contentActor(getPrisma(), user.id)
    const origin = request.headers.get("origin")
    if (origin && origin !== new URL(request.url).origin)
      throw new PlatformError(
        403,
        "INVALID_ORIGIN",
        "Request origin is not permitted"
      )
    if (
      Number(request.headers.get("content-length")) >
      MAX_ARTWORK_BYTES + 65536
    )
      throw new PlatformError(
        413,
        "FILE_TOO_LARGE",
        "Artwork must be at most 8 MB"
      )
    const reader = request.body?.getReader()
    if (!reader)
      throw new PlatformError(400, "FILE_REQUIRED", "Choose an image")
    const chunks: Uint8Array[] = []
    let bytes = 0
    while (true) {
      const chunk = await reader.read()
      if (chunk.done) break
      bytes += chunk.value.byteLength
      if (bytes > MAX_ARTWORK_BYTES + 65536) {
        await reader.cancel()
        throw new PlatformError(
          413,
          "FILE_TOO_LARGE",
          "Artwork must be at most 8 MB"
        )
      }
      chunks.push(chunk.value)
    }
    const form = await new Response(new Uint8Array(Buffer.concat(chunks)), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData()
    const file = form.get("file")
    if (user.role !== "ADMIN") {
      const contentId = form.get("contentId")
      if (typeof contentId !== "string") throw new PlatformError(400, "DESTINATION_REQUIRED", "Save your title before uploading artwork.")
      await contentAccess(getPrisma(), user.id, contentId, true)
    }
    if (!(file instanceof File))
      throw new PlatformError(400, "FILE_REQUIRED", "Choose an image")
    const upload = await uploadArtwork(file, form.get("purpose"))
    const record = await getPrisma().$transaction(async (tx) => {
      const asset = await tx.artworkAsset.create({
        data: { ...upload, uploadedById: user.id },
      })
      await tx.auditLog.create({
        data: {
          actorId: user.id,
          action: "UPLOAD_ARTWORK",
          entityType: "artwork",
          entityId: asset.id,
        },
      })
      return asset
    })
    return apiSuccess(record, "Artwork uploaded")
  } catch (error) {
    return routeError(error, "Artwork upload failed")
  }
}
