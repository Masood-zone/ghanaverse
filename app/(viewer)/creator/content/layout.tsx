import type { ReactNode } from "react"
import Link from "@/components/common/app-link"
import { getOptionalUser } from "@/lib/auth/access"
import { canManageContent } from "@/lib/auth/policy"
export const metadata = { robots: { index: false, follow: false } }
export default async function CreatorContentLayout({
  children,
}: {
  children: ReactNode
}) {
  const access = await getOptionalUser()
  if (!access || !canManageContent(access.user.role)) return children
  return (
    <section className="gv-admin gv-container py-8">
      <nav
        aria-label="Creator workspace"
        className="mb-6 flex gap-5 text-sm font-bold text-primary"
      >
        <Link href="/creator/content">Content</Link>
        <Link href="/creator/analytics">Analytics</Link>
      </nav>
      {children}
    </section>
  )
}
