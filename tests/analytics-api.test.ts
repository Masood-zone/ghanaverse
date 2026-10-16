import { beforeEach, describe, expect, it, vi } from "vitest"
const access = vi.hoisted(() => ({
  requireUser: vi.fn(),
  requireAdmin: vi.fn(),
}))
vi.mock("@/lib/auth/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/access")>()),
  ...access,
}))
import { AccessError } from "@/lib/auth/access"
import { handleAnalytics } from "@/services/analytics/handler"
beforeEach(() => {
  access.requireUser.mockReset()
  access.requireAdmin.mockReset()
})
describe("analytics API authorization", () => {
  it("requires sign-in for both JSON and CSV rights-holder reports", async () => {
    access.requireUser.mockRejectedValue(new AccessError("AUTH_REQUIRED"))
    for (const format of ["json", "csv"])
      expect(
        (
          await handleAnalytics(
            new Request(
              `http://localhost:3000/api/creator/analytics?format=${format}`
            ),
            false
          )
        ).status
      ).toBe(401)
  })
  it("protects administrator reports and exports with administrator authorization", async () => {
    access.requireAdmin.mockRejectedValue(new AccessError("ADMIN_REQUIRED"))
    for (const format of ["json", "csv"])
      expect(
        (
          await handleAnalytics(
            new Request(
              `http://localhost:3000/api/admin/analytics?format=${format}`
            ),
            true
          )
        ).status
      ).toBe(403)
    expect(access.requireUser).not.toHaveBeenCalled()
  })
})
