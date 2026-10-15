import { useMutation } from "@tanstack/react-query"
import api from "@/lib/axios"
import { ApiClientError } from "@/lib/api-client-error"
import type { ApiResponse } from "@/types"
import type { UploadedArtwork } from "@/types/uploads"
import type { UploadPurpose } from "@/lib/validation/uploads"
export async function uploadFileToCloudinary({
  file,
  purpose,
}: {
  file: File
  purpose: UploadPurpose
}) {
  const body = new FormData()
  body.append("file", file)
  body.append("purpose", purpose)
  const { data } = await api.post<ApiResponse<UploadedArtwork>>(
    "/uploads",
    body,
    { timeout: 120000 }
  )
  if (!data.success || !data.data)
    throw new ApiClientError(data.message ?? "Upload failed")
  return data.data
}
export function useUploadFile() {
  return useMutation({ mutationFn: uploadFileToCloudinary })
}
