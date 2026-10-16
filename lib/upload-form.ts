import "server-only"
import { MAX_ARTWORK_BYTES } from "@/lib/validation/uploads"
import { PlatformError } from "@/lib/route-error"
export async function readUploadForm(request: Request) {
  const limit = MAX_ARTWORK_BYTES + 65536
  const tooLarge = () =>
    new PlatformError(413, "FILE_TOO_LARGE", "Images must be at most 8 MB.")
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge()
  const reader = request.body?.getReader()
  if (!reader) throw new PlatformError(400, "FILE_REQUIRED", "Choose an image.")
  const chunks: Uint8Array[] = []
  let bytes = 0
  while (true) {
    const chunk = await reader.read()
    if (chunk.done) break
    bytes += chunk.value.byteLength
    if (bytes > limit) {
      await reader.cancel()
      throw tooLarge()
    }
    chunks.push(chunk.value)
  }
  try {
    return await new Response(new Uint8Array(Buffer.concat(chunks)), {
      headers: { "content-type": request.headers.get("content-type") ?? "" },
    }).formData()
  } catch {
    throw new PlatformError(
      400,
      "INVALID_UPLOAD",
      "Send an image using multipart form data."
    )
  }
}
