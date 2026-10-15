import type { ActivityPage } from "@/types/admin"
import { getAdminResource, useAdminResource } from "./queries"
export function getAdminActivity(params = "") {
  return getAdminResource<ActivityPage>(`activity${params ? "?" + params : ""}`)
}
export function useAdminActivity(params = "") {
  return useAdminResource<ActivityPage>(`activity${params ? "?" + params : ""}`)
}
