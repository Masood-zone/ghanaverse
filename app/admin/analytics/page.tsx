import { AnalyticsContent } from "@/components/analytics/analytics-content"
import { requireAdminPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  await requireAdminPage(
    callbackWithSearch("/admin/analytics", await searchParams)
  )
  return <AnalyticsContent audience="admin" />
}
