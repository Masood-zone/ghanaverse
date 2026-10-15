import type { ContentPage, EditorRecord } from "@/types/admin"
import { getAdminResource, useAdminResource } from "./queries"
export function getAdminContent(params = "") {
  return getAdminResource<ContentPage>(`content?${params}`)
}
export function useAdminContent(params = "") {
  return useAdminResource<ContentPage>(`content?${params}`)
}
export function getAdminContentRecord(id: string) {
  return getAdminResource<EditorRecord>(`content/${id}`)
}
export function useAdminContentRecord(id: string) {
  return useAdminResource<EditorRecord>(`content/${id}`, id !== "new")
}
