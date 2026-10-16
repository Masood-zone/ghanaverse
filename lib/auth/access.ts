import "server-only"
import { cache } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { getAuth } from "@/lib/auth"
import { isAdminRole } from "@/lib/auth/policy"
import { safeCallbackUrl } from "@/lib/auth/callback"

export class AccessError extends Error {
  constructor(public readonly code: "AUTH_REQUIRED" | "ADMIN_REQUIRED") {
    super(code)
  }
}

// React deduplicates this only during a server render, never across requests.
export const getOptionalUser = cache(async () => {
  const session = await getAuth().api.getSession({ headers: await headers() })
  return session && !session.user.isSuspended
    ? { session, user: session.user }
    : null
})

export async function requireUser() {
  const access = await getOptionalUser()
  if (!access) throw new AccessError("AUTH_REQUIRED")
  return access
}

export async function requireAdmin() {
  const access = await requireUser()
  if (!isAdminRole(access.user.role)) throw new AccessError("ADMIN_REQUIRED")
  return access
}

export async function requireUserPage(callbackUrl: string) {
  try {
    return await requireUser()
  } catch (error) {
    if (!(error instanceof AccessError)) throw error
    redirect(
      `/auth?callbackUrl=${encodeURIComponent(safeCallbackUrl(callbackUrl))}`
    )
  }
}

export async function requireAdminPage(callbackUrl = "/admin") {
  try {
    return await requireAdmin()
  } catch (error) {
    if (!(error instanceof AccessError)) throw error
    if (error.code === "AUTH_REQUIRED")
      redirect(
        `/auth?callbackUrl=${encodeURIComponent(safeCallbackUrl(callbackUrl))}`
      )
    redirect("/")
  }
}
