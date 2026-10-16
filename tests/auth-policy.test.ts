import { describe, expect, it } from "vitest"
import { UserRole } from "@/app/generated/prisma/enums"
import { DEFAULT_REGISTRATION_ROLE, isAdminRole } from "@/lib/auth/policy"
import {
  getAuthFormSchema,
  getRegistrationValidationError,
  REGISTRATION_FAILURE_MESSAGE,
  SIGN_IN_FAILURE_MESSAGE,
} from "@/lib/auth/form-validation"

describe("foundation registration policy", () => {
  it("accepts short seeded passwords at sign-in while retaining registration rules", () => {
    const values = {
      email: "admin@example.test",
      password: "x",
      name: "",
      confirmPassword: "",
    }
    expect(getAuthFormSchema("sign-in").safeParse(values).success).toBe(true)
    expect(getAuthFormSchema("register").safeParse(values).success).toBe(false)
    expect(
      getAuthFormSchema("sign-in").safeParse({ ...values, password: "" })
        .success
    ).toBe(false)
  })
  it("defaults every registration to VIEWER", () =>
    expect(DEFAULT_REGISTRATION_ROLE).toBe(UserRole.VIEWER))
  it("allows only ADMIN through the admin policy", () => {
    expect(isAdminRole(UserRole.ADMIN)).toBe(true)
    expect(isAdminRole(UserRole.VIEWER)).toBe(false)
  })
  it("defines the viewer, rights-holder and administrator roles", () =>
    expect(Object.values(UserRole)).toEqual([
      "VIEWER",
      "RIGHTS_HOLDER",
      "ADMIN",
    ]))
  it("requires matching registration passwords before an auth request", () => {
    expect(
      getRegistrationValidationError("viewer-password", "different-password")
    ).toBe("Passwords do not match.")
    expect(
      getRegistrationValidationError("viewer-password", "viewer-password")
    ).toBeUndefined()
  })
  it("uses sanitized authentication failure messages", () => {
    expect(SIGN_IN_FAILURE_MESSAGE).toBe(
      "Unable to sign in. Please check your email and password."
    )
    expect(REGISTRATION_FAILURE_MESSAGE).toBe(
      "Unable to create your account. Please try again."
    )
  })
})
