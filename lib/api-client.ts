import axios from "@/lib/axios"
import type { ApiResponse } from "@/types"
import { ApiClientError } from "@/lib/api-client-error"
export { ApiClientError } from "@/lib/api-client-error"
export type { ApiResponse } from "@/types"
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await axios.request<ApiResponse<T>>({
    url: path,
    method: init?.method ?? "GET",
    signal: init?.signal ?? undefined,
    data: typeof init?.body === "string" ? JSON.parse(init.body) : init?.body,
  })
  const body = response.data
  if (!body.success || body.data === undefined)
    throw new ApiClientError(
      body.message ?? "Request failed",
      response.status,
      body.code,
      body.errors
    )
  return body.data
}
