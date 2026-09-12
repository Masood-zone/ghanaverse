import { describe, expect, it } from "vitest";
import { UserRole } from "@/generated/prisma/enums";
import { DEFAULT_REGISTRATION_ROLE, isAdminRole } from "@/lib/auth/policy";

describe("foundation registration policy", () => {
  it("defaults every registration to VIEWER", () => expect(DEFAULT_REGISTRATION_ROLE).toBe(UserRole.VIEWER));
  it("allows only ADMIN through the admin policy", () => { expect(isAdminRole(UserRole.ADMIN)).toBe(true); expect(isAdminRole(UserRole.VIEWER)).toBe(false); });
  it("defines only the two Phase 3 roles", () => expect(Object.values(UserRole)).toEqual(["VIEWER", "ADMIN"]));
});
