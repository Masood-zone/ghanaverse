"use client"
import { Bookmark, Check, LoaderCircle } from "lucide-react"
import { useIsMutating } from "@tanstack/react-query"
import { useNavigationRouter as useRouter } from "@/components/providers/navigation-loading"
import { toast } from "sonner"
import { authClient } from "@/lib/auth-client"
import { useWatchlist, useWatchlistMutation } from "@/services/viewer/watchlist"
export function WatchlistButton({
  contentId,
  compact = false,
  title,
}: {
  contentId: string
  compact?: boolean
  title?: string
  slug?: string
  authenticated?: boolean
  initialSaved?: boolean
}) {
  const { data: session, isPending: sessionPending } = authClient.useSession()
  const { account, profileId, query } = useWatchlist()
  const mutation = useWatchlistMutation(contentId, profileId, account.data?.id)
  const router = useRouter()
  const saving =
    useIsMutating({ mutationKey: ["watchlist-toggle", profileId, contentId] }) >
    0
  const loading =
    sessionPending ||
    Boolean(session && (account.isPending || (profileId && query.isPending)))
  const saved = query.data?.contentIds.includes(contentId) ?? false
  const label = saved ? "In My List" : "Add to My List"
  const error = account.error ?? query.error
  return (
    <button
      type="button"
      aria-label={
        compact
          ? `${saved ? "Remove" : "Save"} ${title ?? "title"}${saved ? " from" : " to"} My List`
          : label
      }
      aria-pressed={saved}
      aria-busy={saving || loading}
      disabled={saving || loading}
      className={
        compact
          ? "grid h-9 w-9 place-items-center rounded-full bg-white/95 text-slate-800 shadow-sm hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-60"
          : "inline-flex items-center gap-2 rounded-md border border-white/45 bg-white/10 px-5 py-3 text-sm font-bold text-white disabled:opacity-60"
      }
      onClick={() => {
        if (!session) {
          router.push(
            `/auth?callbackUrl=${encodeURIComponent(window.location.pathname + window.location.search)}`
          )
          return
        }
        if (error) {
          toast.error(error.message)
          void account.refetch()
          if (profileId) void query.refetch()
          return
        }
        if (!profileId) {
          router.push("/profiles")
          return
        }
        mutation.mutate(saved, {
          onSuccess: () => {
            toast.success(saved ? "Removed from My List." : "Added to My List.")
            router.refresh()
          },
          onError: (error) => toast.error(error.message),
        })
      }}
    >
      {saving || loading ? (
        <LoaderCircle className="h-4 w-4 animate-spin" />
      ) : saved ? (
        <Check className="h-4 w-4" />
      ) : (
        <Bookmark className="h-4 w-4" />
      )}
      {!compact ? (saving ? "Updating My List…" : label) : null}
    </button>
  )
}
