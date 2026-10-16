import { FoundationPage } from "@/components/layout/foundation-page"
import { requireAdminPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  await requireAdminPage(
    callbackWithSearch("/admin/royalties", await searchParams)
  )
  return (
    <FoundationPage
      eyebrow="Administration"
      title="Royalties"
      description="Royalty calculations are intentionally deferred."
    />
  )
}
