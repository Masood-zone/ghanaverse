import { requireUserPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"
import { analyticsScope } from "@/services/analytics/operations"
import { PlatformError } from "@/lib/route-error"
import { AnalyticsContent } from "@/components/analytics/analytics-content"
export const metadata = { robots: { index: false, follow: false } }
export default async function RightsHolderReportsPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>
}) {
  const { user } = await requireUserPage(
    callbackWithSearch("/creator/analytics", await searchParams)
  )
  try {
    await analyticsScope(user.id)
  } catch (error) {
    if (!(error instanceof PlatformError)) throw error
    return (
      <section className="gv-container py-16">
        <h1 className="text-3xl font-bold">Rights-holder access required</h1>
        <p className="mt-4 text-muted-foreground">
          An administrator must assign your account to a rights holder before
          you can view these reports.
        </p>
      </section>
    )
  }
  return <AnalyticsContent audience="creator" />
}
