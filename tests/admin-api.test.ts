import { beforeEach, describe, expect, it, vi } from "vitest"
const access = vi.hoisted(() => ({ requireAdmin: vi.fn() }))
vi.mock("@/lib/auth/access", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/auth/access")>()),
  requireAdmin: access.requireAdmin,
}))
import { handleAdmin } from "@/services/admin/handler"
import { AccessError } from "@/lib/auth/access"
beforeEach(() => {
  access.requireAdmin.mockReset()
})
describe("administration API boundaries", () => {
  it("rejects unauthenticated requests before reading records", async () => {
    access.requireAdmin.mockRejectedValue(new AccessError("AUTH_REQUIRED"))
    expect(
      (await handleAdmin(new Request("http://localhost:3000/api/admin/users")))
        .status
    ).toBe(401)
  })
  it("rejects cross-origin mutations", async () => {
    access.requireAdmin.mockResolvedValue({ user: { id: "admin" } })
    const result = await handleAdmin(
      new Request("http://localhost:3000/api/admin/creators", {
        method: "POST",
        headers: { origin: "https://other.example" },
        body: JSON.stringify({ name: "Creator" }),
      })
    )
    expect(result.status).toBe(403)
  })
  it("returns a validation response for malformed JSON", async () => {
    access.requireAdmin.mockResolvedValue({ user: { id: "admin" } })
    expect(
      (
        await handleAdmin(
          new Request("http://localhost:3000/api/admin/creators", {
            method: "POST",
            body: "{",
          })
        )
      ).status
    ).toBe(400)
  })
})
