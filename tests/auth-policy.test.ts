import { describe, expect, it } from "vitest";
import { UserRole } from "@/generated/prisma/enums";
import { DEFAULT_REGISTRATION_ROLE, isAdminRole } from "@/lib/auth/policy";
import { getRegistrationValidationError, REGISTRATION_FAILURE_MESSAGE, SIGN_IN_FAILURE_MESSAGE } from "@/lib/auth/form-validation";

describe("foundation registration policy", () => {
  it("defaults every registration to VIEWER", () => expect(DEFAULT_REGISTRATION_ROLE).toBe(UserRole.VIEWER));
  it("allows only ADMIN through the admin policy", () => { expect(isAdminRole(UserRole.ADMIN)).toBe(true); expect(isAdminRole(UserRole.VIEWER)).toBe(false); });
  it("defines only the two Phase 3 roles", () => expect(Object.values(UserRole)).toEqual(["VIEWER", "ADMIN"]));
  it("requires matching registration passwords before an auth request", () => {
    expect(getRegistrationValidationError("viewer-password", "different-password")).toBe("Passwords do not match.");
    expect(getRegistrationValidationError("viewer-password", "viewer-password")).toBeUndefined();
  });
  it("uses sanitized authentication failure messages", () => {
    expect(SIGN_IN_FAILURE_MESSAGE).toBe("Unable to sign in. Please check your email and password.");
    expect(REGISTRATION_FAILURE_MESSAGE).toBe("Unable to create your account. Please try again.");
  });
});
