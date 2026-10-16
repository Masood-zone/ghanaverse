import type { getAnalytics } from "@/services/analytics/operations"
export type AnalyticsReport = Awaited<ReturnType<typeof getAnalytics>>
