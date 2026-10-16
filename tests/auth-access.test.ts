import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const request = vi.hoisted(() => ({ headers: new Headers() }))
vi.mock("next/headers", () => ({ headers: async () => request.headers }))
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`)
  },
}))

import { getAuth } from "@/lib/auth"
import { getPrisma } from "@/lib/prisma"
import {
  getOptionalUser,
  requireUser,
  requireAdmin,
  requireUserPage,
  requireAdminPage,
} from "@/lib/auth/access"
import { GET as account } from "@/app/api/account/route"
import { handleAdmin } from "@/services/admin/handler"
import { mutateAdmin } from "@/services/admin/operations"
import { UserRole } from "@/app/generated/prisma/enums"

const db = getPrisma()
const emails = new Set<string>()
const origin = "http://localhost:3000"
async function register(role: UserRole = "VIEWER") {
  const email = `access-${crypto.randomUUID()}@example.test`
  emails.add(email)
  const response = await getAuth().handler(
    new Request(`${origin}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { origin, "content-type": "application/json" },
      body: JSON.stringify({
        name: "Access Check",
        email,
        password: "access-check-password",
      }),
    })
  )
  expect(response.status).toBe(200)
  request.headers = new Headers({
    cookie: response.headers
      .getSetCookie()
      .map((value) => value.split(";")[0])
      .join("; "),
  })
  return db.user.update({ where: { email }, data: { role } })
}
beforeEach(() => {
  request.headers = new Headers()
})
afterEach(async () => {
  await db.auditLog.deleteMany({
    where: {
      actorId: {
        in: (
          await db.user.findMany({
            where: { email: { in: [...emails] } },
            select: { id: true },
          })
        ).map((user) => user.id),
      },
    },
  })
  await db.user.deleteMany({ where: { email: { in: [...emails] } } })
  emails.clear()
})

describe("authoritative server authorization without a proxy", () => {
  it.each(["missing", "forged"])(
    "rejects a %s session at guards and APIs",
    async (kind) => {
      if (kind === "forged")
        request.headers.set("cookie", "better-auth.session_token=forged")
      expect(await getOptionalUser()).toBeNull()
      await expect(requireUser()).rejects.toMatchObject({
        code: "AUTH_REQUIRED",
      })
      const response = await account()
      expect(response.status).toBe(401)
      expect(await response.json()).toMatchObject({ code: "AUTH_REQUIRED" })
    }
  )
  it.each(["expired", "revoked", "suspended"])(
    "rejects a previously valid %s session on the next request",
    async (kind) => {
      const user = await register()
      expect((await requireUser()).user.id).toBe(user.id)
      if (kind === "expired")
        await db.session.updateMany({
          where: { userId: user.id },
          data: { expiresAt: new Date(0) },
        })
      if (kind === "revoked")
        await db.session.deleteMany({ where: { userId: user.id } })
      if (kind === "suspended")
        await db.user.update({
          where: { id: user.id },
          data: { isSuspended: true },
        })
      expect(await getOptionalUser()).toBeNull()
      expect((await account()).status).toBe(401)
    }
  )
  it.each([UserRole.VIEWER, UserRole.RIGHTS_HOLDER])(
    "returns 403 for a signed-in %s at admin APIs",
    async (role) => {
      await register(role)
      await expect(requireAdmin()).rejects.toMatchObject({
        code: "ADMIN_REQUIRED",
      })
      const response = await handleAdmin(
        new Request(`${origin}/api/admin/users`)
      )
      expect(response.status).toBe(403)
      expect(await response.json()).toMatchObject({ code: "ADMIN_REQUIRED" })
      await expect(requireAdminPage("/admin/users")).rejects.toThrow(
        "REDIRECT:/"
      )
    }
  )
  it("uses the persisted role from Better Auth and revokes sessions on access changes", async () => {
    const actor = await register("ADMIN")
    const target = await register("ADMIN")
    expect((await requireAdmin()).user.role).toBe("ADMIN")
    await mutateAdmin(
      new URL(`${origin}/api/admin/users/${target.id}`),
      "PATCH",
      { role: "VIEWER", isSuspended: false },
      actor.id
    )
    expect(await db.session.count({ where: { userId: target.id } })).toBe(0)
    await expect(requireAdmin()).rejects.toMatchObject({
      code: "AUTH_REQUIRED",
    })
  })
  it("preserves deep links and sanitizes redirects", async () => {
    const destination = "/admin/content/example?section=video&episode=3"
    await expect(requireAdminPage(destination)).rejects.toThrow(
      `REDIRECT:/auth?callbackUrl=${encodeURIComponent(destination)}`
    )
    await expect(
      requireUserPage("/library?tab=history&page=2")
    ).rejects.toThrow(
      "REDIRECT:/auth?callbackUrl=%2Flibrary%3Ftab%3Dhistory%26page%3D2"
    )
    await expect(requireUserPage("https://outside.example")).rejects.toThrow(
      "REDIRECT:/auth?callbackUrl=%2F"
    )
  })
  it("propagates infrastructure errors instead of treating them as sign-out", async () => {
    const getSession = vi
      .spyOn(getAuth().api, "getSession")
      .mockRejectedValueOnce(new Error("database unavailable"))
    try {
      await expect(requireUserPage("/account")).rejects.toThrow(
        "database unavailable"
      )
    } finally {
      getSession.mockRestore()
    }
  })
})
