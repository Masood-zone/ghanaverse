import { isAxiosError } from "axios"
import type { ApiResponse } from "@/types"
export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly fieldErrors?: Record<string, string[]>
  ) {
    super(message)
    this.name = "ApiClientError"
  }
}
export function toApiClientError(error: unknown, fallback = "Request failed") {
  if (error instanceof ApiClientError) return error
  if (isAxiosError<ApiResponse<never>>(error))
    return new ApiClientError(
      error.response?.data?.message ?? fallback,
      error.response?.status,
      error.response?.data?.code,
      error.response?.data?.errors
    )
  return new ApiClientError(error instanceof Error ? error.message : fallback)
}
