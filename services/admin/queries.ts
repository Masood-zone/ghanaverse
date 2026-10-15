import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/axios"
import { ApiClientError } from "@/lib/api-client-error"
import type { ApiResponse } from "@/types"
export async function getAdminResource<T>(
  path: string,
  signal?: AbortSignal
): Promise<T> {
  const { data } = await api.get<ApiResponse<T>>(`/admin/${path}`, { signal })
  if (!data.success || data.data === undefined)
    throw new ApiClientError(data.message ?? "Request failed")
  return data.data
}
export function useAdminResource<T>(path: string, enabled = true) {
  return useQuery({
    queryKey: ["admin", path],
    queryFn: ({ signal }) => getAdminResource<T>(path, signal),
    enabled,
  })
}
export function useAdminMutation() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      path,
      method = "POST",
      body,
    }: {
      path: string
      method?: "POST" | "PATCH" | "DELETE" | "PUT"
      body?: unknown
    }) => {
      const { data } = await api.request<ApiResponse<{ id: string }>>({
        url: `/admin/${path}`,
        method,
        data: body,
      })
      if (!data.success || !data.data)
        throw new ApiClientError(data.message ?? "Save failed")
      return data.data
    },
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin"] }),
  })
}
