import { z } from "zod";
import { apiError } from "@/lib/api-response";
import { AccessError } from "@/lib/auth/access";

export class PlatformError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) { super(message); }
}

export function routeError(error: unknown, fallback = "The request could not be completed.") {
  if (error instanceof AccessError) {
    return apiError(error.code === "AUTH_REQUIRED" ? "Authentication required." : "Administrator access required.", error.code === "AUTH_REQUIRED" ? 401 : 403, error.code);
  }
  if (error instanceof PlatformError) return apiError(error.message, error.status, error.code);
  if (error instanceof z.ZodError) return apiError(error.issues[0]?.message ?? "Please correct the submitted fields.", 400, "INVALID_REQUEST");
  console.error(error);
  return apiError(fallback, 500, "REQUEST_FAILED");
}
