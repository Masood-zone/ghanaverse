"use client"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import { useNavigationRouter as useRouter } from "@/components/providers/navigation-loading"
import Link from "@/components/common/app-link"
import { VideoPlayer, type VideoPlayerProps } from "./video-player"
import { EpisodeBrowser } from "./episode-browser"
import { episodeLabel, type EpisodeSummary } from "@/lib/series"
import { ContentArtwork } from "@/components/catalogue/content-artwork"
import { PROFILE_CHANGED_EVENT } from "@/lib/viewer-events"
type Navigation = {
  episodes: EpisodeSummary[]
  current: EpisodeSummary | null
  previous: EpisodeSummary | null
  next: EpisodeSummary | null
}
const subscribeContinuation = () => () => {}
export function SeriesPlayer({
  player,
  navigation,
  autoplayNextEpisode,
  backdrop,
}: {
  player: VideoPlayerProps
  navigation: Navigation
  autoplayNextEpisode: boolean
  backdrop?: string | null
}) {
  const [remaining, setRemaining] = useState<number | null>(null)
  const [changed, setChanged] = useState(false)
  const [episodesOpen, setEpisodesOpen] = useState(false)
  const router = useRouter()
  const autoplay = useSyncExternalStore(
    subscribeContinuation,
    () =>
      sessionStorage.getItem("ghanaverse.next-episode") ===
      `${player.profileId}:${player.assetId}`,
    () => false
  )
  const started = useRef(false)
  useEffect(() => {
    function clearPendingAutoplay() {
      if (
        sessionStorage.getItem("ghanaverse.next-episode") ===
        `${player.profileId}:${player.assetId}`
      )
        sessionStorage.removeItem("ghanaverse.next-episode")
    }
    function stop() {
      clearPendingAutoplay()
      setRemaining(null)
      setChanged(true)
    }
    window.addEventListener(PROFILE_CHANGED_EVENT, stop)
    window.addEventListener("pagehide", clearPendingAutoplay)
    return () => {
      window.removeEventListener(PROFILE_CHANGED_EVENT, stop)
      window.removeEventListener("pagehide", clearPendingAutoplay)
      if (window.location.pathname !== `/watch/${player.assetId}`)
        clearPendingAutoplay()
    }
  }, [player.assetId, player.profileId])
  const onEnded = useCallback(() => {
    if (
      started.current ||
      !autoplayNextEpisode ||
      !navigation.next?.assetId ||
      changed
    )
      return
    started.current = true
    setRemaining(10)
  }, [autoplayNextEpisode, navigation.next, changed])
  useEffect(() => {
    if (remaining === null || changed) return
    if (remaining === 0 && navigation.next?.assetId) {
      sessionStorage.setItem(
        "ghanaverse.next-episode",
        `${player.profileId}:${navigation.next.assetId}`
      )
      router.push(`/watch/${navigation.next.assetId}`)
      return
    }
    const timer = window.setTimeout(
      () => setRemaining((value) => (value === null ? null : value - 1)),
      1000
    )
    return () => window.clearTimeout(timer)
  }, [remaining, navigation.next, changed, player.profileId, router])
  return (
    <div className="space-y-5">
      <VideoPlayer
        {...player}
        autoPlay={autoplay}
        onEnded={onEnded}
        onPlaybackStarted={() => {
          sessionStorage.removeItem("ghanaverse.next-episode")
          setRemaining(null)
        }}
      />
      {remaining !== null ? (
        <div
          role="status"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4"
        >
          <p className="font-semibold">
            Next: {navigation.next ? episodeLabel(navigation.next) : ""} ·{" "}
            {navigation.next?.title} in {remaining}s
          </p>
          <button
            className="gv-action secondary"
            onClick={() => setRemaining(null)}
          >
            Cancel autoplay
          </button>
        </div>
      ) : null}
      <nav
        aria-label="Episode navigation"
        className="grid gap-3 sm:grid-cols-2"
      >
        <EpisodeNeighbour episode={navigation.previous} direction="Previous" />
        <EpisodeNeighbour episode={navigation.next} direction="Next" />
      </nav>
      {navigation.next && !navigation.next.available ? (
        <p role="status" className="rounded-lg bg-amber-50 p-4 text-sm">
          The next episode is unavailable. Autoplay stops here. You can choose a
          later episode from the list below.
        </p>
      ) : null}
      <details
        className="rounded-xl border bg-white"
        onToggle={(event) => setEpisodesOpen(event.currentTarget.open)}
      >
        <summary className="cursor-pointer p-5 font-bold">
          Browse seasons and episodes
        </summary>
        {episodesOpen ? (
          <EpisodeBrowser
            episodes={navigation.episodes}
            currentId={navigation.current?.id}
            initialSeasonId={navigation.current?.seasonId}
            backdrop={backdrop}
          />
        ) : null}
      </details>
    </div>
  )
}
function EpisodeNeighbour({
  episode,
  direction,
}: {
  episode: EpisodeSummary | null
  direction: "Previous" | "Next"
}) {
  const body = (
    <>
      <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded-md">
        <ContentArtwork
          src={episode?.thumbnailUrl}
          alt=""
          variant="landscape"
        />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-primary">{direction} episode</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {episode
            ? `${episodeLabel(episode)}${episode.runtimeMinutes ? ` · ${episode.runtimeMinutes} min` : ""}`
            : direction === "Previous"
              ? "First episode"
              : "You’re up to date"}
        </p>
        <p className="mt-1 truncate font-bold">{episode?.title}</p>
        {episode ? (
          <p className="text-xs text-muted-foreground">
            {!episode.available
              ? "Unavailable"
              : episode.completed
                ? "Replay · Watched"
                : episode.positionSeconds > 0
                  ? "Resume"
                  : "Play"}
          </p>
        ) : null}
      </div>
    </>
  )
  return episode?.assetId ? (
    <Link
      href={`/watch/${episode.assetId}`}
      className="flex items-center gap-3 rounded-xl border bg-white p-4 hover:border-primary"
    >
      {body}
    </Link>
  ) : (
    <div
      aria-disabled="true"
      className="flex items-center gap-3 rounded-xl border bg-muted/60 p-4"
    >
      {body}
    </div>
  )
}
