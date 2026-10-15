import type { AdminOptions } from "@/types/admin"
import { getAdminResource, useAdminResource } from "./queries"
export function getAdminOptions(params = "") {
  return getAdminResource<AdminOptions>(`options${params ? "?" + params : ""}`)
}
export function useAdminOptions(params = "") {
  return useAdminResource<AdminOptions>(`options${params ? "?" + params : ""}`)
}
