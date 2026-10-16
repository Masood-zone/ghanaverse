import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import { useAccount } from "./account"
type SavedTitles = { profileId: string; contentIds: string[] }
export function useWatchlist() {
  const account = useAccount()
  const profileId = account.data?.activeId
  const key = ["viewer", "watchlist", account.data?.id, profileId]
  return {
    account,
    profileId,
    key,
    query: useQuery({
      queryKey: key,
      queryFn: ({ signal }) =>
        api<SavedTitles>(
          `/watchlist?profileId=${encodeURIComponent(profileId!)}`,
          { signal }
        ),
      enabled: Boolean(profileId),
    }),
  }
}
export function useWatchlistMutation(
  contentId: string,
  profileId?: string,
  userId?: string
) {
  const client = useQueryClient()
  return useMutation({
    mutationKey: ["watchlist-toggle", profileId, contentId],
    mutationFn: (saved: boolean) =>
      api("/watchlist", {
        method: saved ? "DELETE" : "PUT",
        body: JSON.stringify({ contentId, profileId }),
      }),
    onSuccess: async (_, saved) => {
      client.setQueryData<SavedTitles>(
        ["viewer", "watchlist", userId, profileId],
        (data) =>
          data
            ? {
                ...data,
                contentIds: saved
                  ? data.contentIds.filter((id) => id !== contentId)
                  : [...new Set([...data.contentIds, contentId])],
              }
            : data
      )
      await client.invalidateQueries({ queryKey: ["viewer", "library"] })
    },
  })
}
