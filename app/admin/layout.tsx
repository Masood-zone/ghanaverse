import type { ReactNode } from "react"
import { getOptionalUser } from "@/lib/auth/access"
import { isAdminRole } from "@/lib/auth/policy"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
export const metadata = { robots: { index: false, follow: false } }
export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const access = await getOptionalUser()
  if (!access || !isAdminRole(access.user.role)) return children
  return <DashboardShell name={access.user.name}>{children}</DashboardShell>
}
