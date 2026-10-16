import "dotenv/config"
import { afterEach, describe, expect, it } from "vitest"
import { getAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"

const origin = "http://localhost:3000"
const createdEmails = new Set<string>()
const authRequest = (path: string, body?: unknown, cookie?: string) =>
  getAuth().handler(
    new Request(`${origin}/api/auth${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        origin,
        ...(body ? { "content-type": "application/json" } : {}),
        ...(cookie ? { cookie } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  )

afterEach(async () => {
  await getPrisma().user.deleteMany({
    where: { email: { in: [...createdEmails] } },
  })
  createdEmails.clear()
})

describe("Better Auth foundation", () => {
  it("refuses new sessions for suspended accounts", async () => {
    const email = `suspended-${Date.now()}@example.test`
    createdEmails.add(email)
    await authRequest("/sign-up/email", {
      name: "Suspended Viewer",
      email,
      password: "foundation-password",
    })
    const user = await getPrisma().user.update({
      where: { email },
      data: { isSuspended: true },
    })
    await getPrisma().session.deleteMany({ where: { userId: user.id } })
    const response = await authRequest("/sign-in/email", {
      email,
      password: "foundation-password",
    })
    expect(response.status).not.toBe(200)
    expect(
      await getPrisma().session.count({ where: { userId: user.id } })
    ).toBe(0)
  })
  it.each(["ADMIN", "RIGHTS_HOLDER"])(
    "registers as VIEWER despite an attempted %s role and maintains a session",
    async (role) => {
      const email = `phase3-${Date.now()}@example.test`
      createdEmails.add(email)
      const response = await authRequest("/sign-up/email", {
        name: "Phase Three",
        email,
        password: "foundation-password",
        role,
      })
      expect(response.status).toBe(200)
      const cookie = response.headers
        .getSetCookie()
        .map((value) => value.split(";")[0])
        .join("; ")
      const session = await authRequest("/get-session", undefined, cookie)
      const body = await session.json()
      expect(body.user.role).toBe("VIEWER")
      expect(
        (await getPrisma().user.findUniqueOrThrow({ where: { email } })).role
      ).toBe("VIEWER")
      expect(
        await getPrisma().viewerProfile.count({ where: { user: { email } } })
      ).toBe(1)
    }
  )

  it("signs in and signs out a credential account", async () => {
    const email = `phase3-${Date.now()}@example.test`
    createdEmails.add(email)
    await authRequest("/sign-up/email", {
      name: "Session Check",
      email,
      password: "foundation-password",
    })
    const response = await authRequest("/sign-in/email", {
      email,
      password: "foundation-password",
    })
    expect(response.status).toBe(200)
    const cookie = response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; ")
    const signOut = await getAuth().handler(
      new Request(`${origin}/api/auth/sign-out`, {
        method: "POST",
        headers: { origin, cookie },
      })
    )
    expect(signOut.status).toBe(200)
    expect(
      await (await authRequest("/get-session", undefined, cookie)).json()
    ).toBeNull()
  })
})
