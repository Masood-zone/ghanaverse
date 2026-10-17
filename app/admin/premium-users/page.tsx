import { requireAdminPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"
import { PremiumUsersContent } from "@/components/admin/premium-users-content"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  await requireAdminPage(
    callbackWithSearch("/admin/premium-users", await searchParams)
  )
  return <PremiumUsersContent />
}
