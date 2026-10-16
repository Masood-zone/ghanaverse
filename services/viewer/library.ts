import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { LibraryData } from "@/types/viewer"
import { useAccount } from "./account"
export const getLibrary = (signal?: AbortSignal) =>
  api<LibraryData>("/viewer/library", { signal })
export function useViewerLibrary() {
  const account = useAccount()
  const query = useQuery({
    queryKey: ["viewer", "library", account.data?.id, account.data?.activeId],
    enabled: Boolean(account.data?.id),
    queryFn: ({ signal }) => getLibrary(signal),
  })
  return {
    ...query,
    error: account.error ?? query.error,
    refetch: async () => {
      await account.refetch()
      return query.refetch()
    },
  }
}
