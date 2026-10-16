import type { ReactNode } from "react"
import Link from "next/link"
import { requireUserPage } from "@/lib/auth/access"
import { contentActor } from "@/services/content/access"
import { getPrisma } from "@/lib/prisma"
import { PlatformError } from "@/lib/route-error"
export const metadata = { robots: { index: false, follow: false } }
export default async function CreatorContentLayout({
  children,
}: {
  children: ReactNode
}) {
  const { user } = await requireUserPage("/creator/content")
  try {
    await contentActor(getPrisma(), user.id)
  } catch (error) {
    if (!(error instanceof PlatformError)) throw error
    return (
      <section className="gv-container py-16">
        <h1 className="text-3xl font-bold">Rights-holder workspace</h1>
        <p className="mt-4">
          An administrator must grant rights-holder access and link your
          organization before you can manage content.
        </p>
      </section>
    )
  }
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
