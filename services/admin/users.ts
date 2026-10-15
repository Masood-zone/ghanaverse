import type { UsersPage } from "@/types/admin"
import { getAdminResource, useAdminResource } from "./queries"
export function getAdminUsers(params = "") {
  return getAdminResource<UsersPage>(`users${params ? "?" + params : ""}`)
}
export function useAdminUsers(params = "") {
  return useAdminResource<UsersPage>(`users${params ? "?" + params : ""}`)
}
