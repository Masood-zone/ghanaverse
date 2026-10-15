import type { CollectionRecord } from "@/types/admin"
import { getAdminResource, useAdminResource } from "./queries"
export function getAdminCollections(params = "") {
  return getAdminResource<CollectionRecord[]>(
    `collections${params ? "?" + params : ""}`
  )
}
export function useAdminCollections(params = "") {
  return useAdminResource<CollectionRecord[]>(
    `collections${params ? "?" + params : ""}`
  )
}
