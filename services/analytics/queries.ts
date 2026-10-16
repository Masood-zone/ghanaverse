import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { AnalyticsReport } from "@/types/analytics"
export function useAnalytics(audience: "admin" | "creator", params: string) {
  return useQuery({
    queryKey: ["analytics", audience, params],
    queryFn: ({ signal }) =>
      api<AnalyticsReport>(`/${audience}/analytics?${params}`, { signal }),
  })
}
