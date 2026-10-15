import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { ProfilesData, ViewerProfile } from "@/types/viewer"
export const getProfiles = (signal?: AbortSignal) =>
  api<ProfilesData>("/profiles", { signal })
export function useViewerProfiles() {
  return useQuery({
    queryKey: ["viewer", "profiles"],
    queryFn: ({ signal }) => getProfiles(signal),
  })
}
export function useSaveProfile() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: ({
      profile,
      name,
      avatar,
    }: {
      profile: ViewerProfile | "new"
      name: string
      avatar: string
    }) =>
      api<ViewerProfile>(
        profile === "new" ? "/profiles" : `/profiles/${profile.id}`,
        {
          method: profile === "new" ? "POST" : "PATCH",
          body: JSON.stringify({ name, avatar }),
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
