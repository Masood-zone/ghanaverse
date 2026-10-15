import { useQuery } from "@tanstack/react-query"
import { api } from "@/lib/api-client"
import type { LibraryData } from "@/types/viewer"
export const getLibrary = (signal?: AbortSignal) =>
  api<LibraryData>("/viewer/library", { signal })
export function useViewerLibrary() {
  return useQuery({
    queryKey: ["viewer", "library"],
    queryFn: ({ signal }) => getLibrary(signal),
  })
}
