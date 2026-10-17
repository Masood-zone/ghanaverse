import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { AccountData } from "@/types/viewer"
import { authClient } from "@/lib/auth-client"
export const getAccount = (signal?: AbortSignal) =>
  api<AccountData>("/account", { signal })
export function useAccount(enabled = true) {
  const { data: session } = authClient.useSession()
  return useQuery({
    queryKey: ["viewer", "account", session?.user.id],
    queryFn: ({ signal }) => getAccount(signal),
    enabled: enabled && Boolean(session?.user),
    refetchInterval: (query) => {
      const premium = query.state.data?.premium
      if (!premium?.active || !premium.expiresAt) return false
      const remaining = Date.parse(premium.expiresAt) - Date.now()
      return remaining > 0 ? Math.min(remaining + 100, 2147483647) : false
    },
  })
}
