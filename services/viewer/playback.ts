import { useMutation, useQueryClient } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { z } from "zod"
import type { progressSchema } from "@/lib/platform-validation"
export type ProgressInput = z.input<typeof progressSchema>
export function saveProgress(input: ProgressInput) {
  return api("/progress", { method: "PUT", body: JSON.stringify(input) })
}
export function useSaveProgress() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: saveProgress,
    onSuccess: () =>
      client.invalidateQueries({ queryKey: ["viewer", "library"], refetchType: "none" }),
  })
}
// Browser page-unload delivery needs fetch's keepalive transport.
export async function flushProgress(input: ProgressInput) {
  const response = await fetch("/api/progress", {
    method: "PUT",
    credentials: "include",
    keepalive: true,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!response.ok) throw new Error("Viewing progress could not be saved")
  return response
}
