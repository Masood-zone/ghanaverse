import { afterAll, describe, expect, it, vi } from "vitest"
const recovery = vi.hoisted(() => ({ url: "" }))
vi.mock("@/services/notifications/providers", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/services/notifications/providers")
  >()),
  sendRecoveryEmail: vi.fn(async (_email: string, url: string) => {
    recovery.url = url
  }),
}))
import { getAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
const db = getPrisma(),
  email = `recovery-${crypto.randomUUID()}@example.test`
const origin = "http://localhost:3000"
function request(path: string, body: unknown, cookie = "") {
  return getAuth().handler(
    new Request(`${origin}/api/auth/${path}`, {
      method: "POST",
      headers: { origin, "content-type": "application/json", cookie },
      body: JSON.stringify(body),
    })
  )
}
afterAll(async () => {
  await db.user.deleteMany({ where: { email } })
})
describe("email recovery and security confirmations", () => {
  it("queues welcome, resets through Better Auth once, revokes sessions and queues security confirmation", async () => {
    const signup = await request("sign-up/email", {
      name: "Recovery Fixture",
      email,
      password: "Original-password-123",
    })
    expect(signup.status).toBe(200)
    const cookie = signup.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
    const user = await db.user.findUniqueOrThrow({ where: { email } })
    expect(
      await db.notificationOutbox.count({
        where: { recipientId: user.id, eventKey: `welcome:${user.id}` },
      })
    ).toBe(1)
    expect(
      (
        await request(
          "change-password",
          {
            currentPassword: "Original-password-123",
            newPassword: "Changed-password-123",
            revokeOtherSessions: true,
          },
          cookie
        )
      ).status
    ).toBe(200)
    expect(
      await db.notificationOutbox.count({
        where: {
          recipientId: user.id,
          eventKey: { startsWith: "password-change:" },
        },
      })
    ).toBe(1)
    expect(
      (
        await request("request-password-reset", {
          email,
          redirectTo: `${origin}/auth/recovery`,
        })
      ).status
    ).toBe(200)
    const url = new URL(recovery.url)
    const token = url.pathname.split("/").at(-1)!
    expect(token.length).toBeGreaterThan(10)
    expect(
      (
        await request("reset-password", {
          token,
          newPassword: "Recovered-password-123",
        })
      ).status
    ).toBe(200)
    expect(await db.session.count({ where: { userId: user.id } })).toBe(0)
    expect(
      await db.notificationOutbox.count({
        where: {
          recipientId: user.id,
          eventKey: { startsWith: "password-reset:" },
        },
      })
    ).toBe(1)
    expect(
      (
        await request("reset-password", {
          token,
          newPassword: "Another-password-123",
        })
      ).status
    ).not.toBe(200)
    expect(
      (
        await request("sign-in/email", {
          email,
          password: "Recovered-password-123",
        })
      ).status
    ).toBe(200)
  })
})
