import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/axios"
import { ApiClientError } from "@/lib/api-client-error"
import type { ApiResponse } from "@/types"
import { useContentScope } from "@/components/admin/content-scope"
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
  const scope = useContentScope()
  return useQuery({
    queryKey: [scope, path],
    queryFn: async ({ signal }) => {
      if (scope === "admin") return getAdminResource<T>(path, signal)
      const { data } = await api.get<ApiResponse<T>>(`/creator/${path}`, { signal })
      if (!data.success || data.data === undefined) throw new ApiClientError(data.message ?? "Request failed")
      return data.data
    },
    enabled,
  })
}
export function useAdminMutation() {
  const scope = useContentScope()
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
        url: `/${scope}/${path}`,
        method,
        data: body,
      })
      if (!data.success || !data.data)
        throw new ApiClientError(data.message ?? "Save failed")
      return data.data
    },
    onSuccess: () => client.invalidateQueries({ queryKey: [scope] }),
  })
}
