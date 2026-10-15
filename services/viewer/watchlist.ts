import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
export function getWatchlistStatus(contentId: string, signal?: AbortSignal) {
  return api<{ saved: boolean }>(
    `/watchlist?contentId=${encodeURIComponent(contentId)}`,
    { signal }
  )
}
export function useWatchlistStatus(
  contentId: string,
  initialSaved: boolean,
  enabled: boolean
) {
  return useQuery({
    queryKey: ["viewer", "watchlist", contentId],
    queryFn: ({ signal }) => getWatchlistStatus(contentId, signal),
    initialData: { saved: initialSaved },
    enabled,
  })
}
export function useWatchlistMutation(contentId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (saved: boolean) =>
      api("/watchlist", {
        method: saved ? "DELETE" : "PUT",
        body: JSON.stringify({ contentId }),
      }),
    onMutate: () =>
      client.cancelQueries({ queryKey: ["viewer", "watchlist", contentId] }),
    onSuccess: (_, wasSaved) => {
      client.setQueryData(["viewer", "watchlist", contentId], {
        saved: !wasSaved,
      })
      return client.invalidateQueries({ queryKey: ["viewer", "library"] })
    },
  })
}
