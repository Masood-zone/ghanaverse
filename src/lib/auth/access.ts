import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "@/lib/auth";
import { getPrisma } from "@/lib/prisma";
import { isAdminRole } from "@/lib/auth/policy";

export class AccessError extends Error {
  constructor(public readonly code: "AUTH_REQUIRED" | "ADMIN_REQUIRED") {
    super(code);
  }
}

export async function requireUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) throw new AccessError("AUTH_REQUIRED");
  const user = await getPrisma().user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new AccessError("AUTH_REQUIRED");
  return { session, user };
}

export async function requireAdmin() {
  const access = await requireUser();
  if (!isAdminRole(access.user.role)) throw new AccessError("ADMIN_REQUIRED");
  return access;
}

export async function requireUserPage(callbackUrl: string) {
  try {
    return await requireUser();
  } catch {
    redirect(`/auth?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
}

export async function requireAdminPage() {
  try {
    return await requireAdmin();
  } catch (error) {
    if (error instanceof AccessError && error.code === "AUTH_REQUIRED") redirect("/auth?callbackUrl=%2Fadmin");
    redirect("/");
  }
}
