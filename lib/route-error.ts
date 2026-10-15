import { z } from "zod"
import { apiError } from "@/lib/api-response"
import { AccessError } from "@/lib/auth/access"

export class PlatformError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string
  ) {
    super(message)
  }
}

export function routeError(
  error: unknown,
  fallback = "The request could not be completed."
) {
  if (error instanceof AccessError) {
    return apiError(
      error.code === "AUTH_REQUIRED"
        ? "Authentication required."
        : "Administrator access required.",
      error.code === "AUTH_REQUIRED" ? 401 : 403,
      error.code
    )
  }
  if (error instanceof PlatformError)
    return apiError(error.message, error.status, error.code)
  if (error instanceof z.ZodError)
    return Response.json(
      {
        success: false,
        message:
          error.issues[0]?.message ?? "Please correct the submitted fields.",
        code: "INVALID_REQUEST",
        errors: z.flattenError(error).fieldErrors,
      },
      { status: 400 }
    )
  if (error instanceof SyntaxError)
    return apiError("Request must contain valid JSON", 400, "INVALID_JSON")
  if (typeof error === "object" && error && "code" in error) {
    if (error.code === "P2002")
      return apiError(
        "A record with these details already exists",
        409,
        "DUPLICATE_RECORD"
      )
    if (error.code === "P2025")
      return apiError("Record was not found", 404, "NOT_FOUND")
    if (error.code === "P2003")
      return apiError(
        "A referenced record is missing or in use",
        409,
        "INVALID_REFERENCE"
      )
  }
  console.error(error)
  return apiError(fallback, 500, "REQUEST_FAILED")
}
