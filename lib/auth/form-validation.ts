import { z } from "zod"

export function getAuthFormSchema(mode: "sign-in" | "register") {
  return z.object({
    email: z.email("Enter a valid email"),
    password:
      mode === "register"
        ? z.string().min(8, "Use at least 8 characters")
        : z.string().min(1, "Enter your password"),
    name: z.string(),
    confirmPassword: z.string(),
  })
}

export const SIGN_IN_FAILURE_MESSAGE =
  "Unable to sign in. Please check your email and password."
export const REGISTRATION_FAILURE_MESSAGE =
  "Unable to create your account. Please try again."

export function getRegistrationValidationError(
  password: string,
  confirmPassword: string
) {
  return password === confirmPassword ? undefined : "Passwords do not match."
}
