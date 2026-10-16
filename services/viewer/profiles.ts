import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { ProfilesData, ViewerProfile } from "@/types/viewer"
import type { z } from "zod"
import type { profileSchema } from "@/lib/platform-validation"
import { authClient } from "@/lib/auth-client"
export const getProfiles = (signal?: AbortSignal) =>
  api<ProfilesData>("/profiles", { signal })
export function useViewerProfiles() {
  const { data: session } = authClient.useSession()
  return useQuery({
    queryKey: ["viewer", "profiles", session?.user.id],
    enabled: Boolean(session?.user),
    queryFn: ({ signal }) => getProfiles(signal),
  })
}
export function useSaveProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      profile,
      values,
    }: {
      profile: ViewerProfile | "new"
      values: z.output<typeof profileSchema>
    }) =>
      api<ViewerProfile>(
        profile === "new" ? "/profiles" : `/profiles/${profile.id}`,
        {
          method: profile === "new" ? "POST" : "PATCH",
          body: JSON.stringify(values),
        }
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["viewer"] }),
  })
}
export function useDeleteProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      api<{ id: string }>(`/profiles/${id}`, { method: "DELETE" }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["viewer"] }),
  })
}
export function useSelectProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (profileId: string) =>
      api<ViewerProfile>("/profiles/select", {
        method: "POST",
        body: JSON.stringify({ profileId }),
      }),
    onSuccess: () => client.invalidateQueries({ queryKey: ["viewer"] }),
  })
}
