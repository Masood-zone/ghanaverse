"use client"

import { Bookmark, Check } from "@/components/common/icons"
import Link from "next/link"
import {
  useWatchlistStatus,
  useWatchlistMutation,
} from "@/services/viewer/watchlist"
import { toast } from "sonner"

export function WatchlistButton({
  contentId,
  slug,
  authenticated,
  initialSaved = false,
}: {
  contentId: string
  slug: string
  authenticated: boolean
  initialSaved?: boolean
}) {
  const status = useWatchlistStatus(contentId, initialSaved, authenticated),
    mutation = useWatchlistMutation(contentId)
  if (!authenticated)
    return (
      <Link
        href={`/auth?callbackUrl=${encodeURIComponent(`/title/${slug}`)}`}
        className="inline-flex items-center gap-2 rounded-md border border-white/45 bg-white/10 px-5 py-3 text-sm font-bold text-white"
      >
        <Bookmark className="h-4 w-4" />
        Add to My List
      </Link>
    )
  const saved = status.data.saved
  return (
    <button
      disabled={mutation.isPending}
      onClick={() =>
        mutation.mutate(saved, {
          onSuccess: () =>
            toast.success(
              saved ? "Removed from My List." : "Added to My List."
            ),
          onError: (error) => toast.error(error.message),
        })
      }
      className="inline-flex items-center gap-2 rounded-md border border-white/45 bg-white/10 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
    >
      {saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
      {saved ? "In My List" : "Add to My List"}
    </button>
  )
}
