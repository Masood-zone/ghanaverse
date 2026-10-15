import type { DashboardData } from "@/types/admin"
import { getAdminResource, useAdminResource } from "./queries"
export function getAdminDashboard(params = "") {
  return getAdminResource<DashboardData>(
    `dashboard${params ? "?" + params : ""}`
  )
}
export function useAdminDashboard(params = "") {
  return useAdminResource<DashboardData>(
    `dashboard${params ? "?" + params : ""}`
  )
}
