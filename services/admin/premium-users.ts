import { useAdminResource } from "./queries"
import type { readPremiumUsers } from "./premium-users-operations"

export type PremiumUsersPage = Awaited<ReturnType<typeof readPremiumUsers>>

export function usePremiumUsers(params: string) {
  return useAdminResource<PremiumUsersPage>(`premium-users?${params}`)
}
