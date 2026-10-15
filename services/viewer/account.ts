import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { AccountData } from "@/types/viewer"
export const getAccount = (signal?: AbortSignal) =>
  api<AccountData>("/account", { signal })
export function useAccount() {
  return useQuery({
    queryKey: ["viewer", "account"],
    queryFn: ({ signal }) => getAccount(signal),
  })
}
