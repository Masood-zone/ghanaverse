import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { BillingSummary, PaymentVerification } from "@/types/billing"
import { authClient } from "@/lib/auth-client"
export function useBilling(authenticated = true) {
  const { data: session } = authClient.useSession()
  return useQuery({
    queryKey: [
      "billing",
      authenticated ? "account" : "plans",
      session?.user.id,
    ],
    queryFn: ({ signal }) =>
      api<BillingSummary>(authenticated ? "/billing" : "/billing/plans", {
        signal,
      }),
    enabled: !authenticated || Boolean(session),
  })
}
export function useBillingMutation<T>(path: string, method = "POST") {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: unknown) =>
      api<T>(path, { method, body: JSON.stringify(body) }),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["billing"] })
      await client.invalidateQueries({ queryKey: ["viewer"] })
    },
  })
}
export function usePaymentVerification(reference: string) {
  const client = useQueryClient()
  const { data: session } = authClient.useSession()
  return useQuery({
    queryKey: ["payment-verification", session?.user.id, reference],
    queryFn: async () => {
      const result = await api<PaymentVerification>("/billing/verify", {
        method: "POST",
        body: JSON.stringify({ reference }),
      })
      await Promise.all([
        client.invalidateQueries({ queryKey: ["billing"] }),
        client.invalidateQueries({ queryKey: ["viewer"] }),
      ])
      return result
    },
    enabled: Boolean(reference && session),
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    // Status changes are checked on entry or by the explicit check button.
    staleTime: 0,
  })
}
