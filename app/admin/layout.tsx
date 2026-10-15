import type { ReactNode } from "react"
import { requireAdminPage } from "@/lib/auth/access"
import { DashboardShell } from "@/components/dashboard/dashboard-shell"
export const metadata = { robots: { index: false, follow: false } }
export default async function AdminLayout({
  children,
}: {
  children: ReactNode
}) {
  const { user } = await requireAdminPage()
  return <DashboardShell name={user.name}>{children}</DashboardShell>
}
