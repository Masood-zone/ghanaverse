import "server-only"
import { v2 as cloudinary, type UploadApiResponse } from "cloudinary"
import sharp from "sharp"
import { PlatformError } from "@/lib/route-error"
import {
  uploadPurposeSchema,
  MAX_ARTWORK_BYTES,
  allowedImageTypes,
} from "@/lib/validation/uploads"
export async function uploadArtwork(file: File, purposeValue: unknown) {
  const purpose = uploadPurposeSchema.parse(purposeValue)
  if (
    !allowedImageTypes.includes(file.type) ||
    file.size > MAX_ARTWORK_BYTES ||
    !file.size
  )
    throw new PlatformError(
      400,
      "INVALID_FILE",
      "Choose a JPEG, PNG or WebP image up to 8 MB"
    )
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME,
    apiKey = process.env.CLOUDINARY_API_KEY,
    apiSecret = process.env.CLOUDINARY_API_SECRET
  let image: Buffer
  try {
    const input = Buffer.from(await file.arrayBuffer())
    const metadata = await sharp(input, {
      limitInputPixels: 40000000,
    }).metadata()
    if (!["jpeg", "png", "webp"].includes(metadata.format ?? ""))
      throw new Error("Unsupported image contents")
    image = await sharp(input, {
      limitInputPixels: 40000000,
    })
      .rotate()
      .resize({
        width: 3840,
        height: 3840,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer()
  } catch {
    throw new PlatformError(
      400,
      "INVALID_IMAGE",
      "The file could not be decoded as a supported image"
    )
  }
  if (!cloudName || !apiKey || !apiSecret)
    throw new PlatformError(
      503,
      "UPLOADS_UNAVAILABLE",
      "Artwork uploads require Cloudinary configuration. Your draft has been preserved."
    )
  cloudinary.config({
    cloud_name: cloudName,
    api_key: apiKey,
    api_secret: apiSecret,
    secure: true,
  })
  const upload = await new Promise<UploadApiResponse>((resolve, reject) => {
    cloudinary.uploader
      .upload_stream(
        { folder: `ghanaverse/artwork/${purpose}`, resource_type: "image" },
        (error, result) => {
          if (error || !result)
            reject(new Error("Artwork provider upload failed"))
          else resolve(result)
        }
      )
      .end(image)
  })
  return {
    publicId: upload.public_id,
    secureUrl: upload.secure_url,
    purpose,
    width: upload.width,
    height: upload.height,
    bytes: upload.bytes,
  }
}
