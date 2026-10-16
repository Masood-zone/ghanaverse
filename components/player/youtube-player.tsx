"use client"
import { useEffect, useRef, useState } from "react"
import { usePlaybackTracking } from "./use-playback-tracking"
type YTPlayer = {
  getCurrentTime(): number
  getDuration(): number
  getPlayerState(): number
  getPlaybackRate(): number
  seekTo(time: number, allow: boolean): void
  destroy(): void
}
type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      videoId: string
      host: string
      playerVars: Record<string, string | number>
      events: {
        onReady(): void
        onStateChange(event: { data: number }): void
        onError(event: { data: number }): void
      }
    }
  ) => YTPlayer
}
declare global {
  interface Window {
    YT?: YTNamespace
    onYouTubeIframeAPIReady?: () => void
  }
}
let apiReady: Promise<YTNamespace> | undefined
function loadYouTube() {
  if (window.YT?.Player) return Promise.resolve(window.YT)
  if (!apiReady)
    apiReady = new Promise<YTNamespace>((resolve, reject) => {
      const previous = window.onYouTubeIframeAPIReady
      const timeout = window.setTimeout(
        () => reject(new Error("YouTube took too long to load.")),
        20000
      )
      window.onYouTubeIframeAPIReady = () => {
        previous?.()
        window.clearTimeout(timeout)
        if (window.YT) resolve(window.YT)
      }
      const script = document.createElement("script")
      script.src = "https://www.youtube.com/iframe_api"
      script.async = true
      script.onerror = () => {
        window.clearTimeout(timeout)
        reject(new Error("YouTube could not load. Check your connection."))
      }
      document.head.appendChild(script)
    }).catch((error) => {
      apiReady = undefined
      throw error
    })
  return apiReady
}
export function YouTubePlayer({
  assetId,
  videoId,
  initialPosition = 0,
}: {
  assetId: string
  videoId: string
  initialPosition?: number
}) {
  const container = useRef<HTMLDivElement>(null)
  const player = useRef<YTPlayer | null>(null)
  const tracking = usePlaybackTracking(assetId)
  const { observe, start, flush } = tracking
  const [error, setError] = useState("")
  const [ready, setReady] = useState(false)
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    let cancelled = false
    let playerReady = false
    const sample = () => {
      const current = player.current
      if (!current || !playerReady || cancelled) return
      observe({
        position: current.getCurrentTime() || 0,
        duration: current.getDuration() || 0,
        rate: current.getPlaybackRate() || 1,
        playing: current.getPlayerState() === 1,
        visible: true,
      })
    }
    void loadYouTube()
      .then((YT) => {
        if (cancelled || !container.current) return
        const element = document.createElement("div")
        container.current.replaceChildren(element)
        player.current = new YT.Player(element, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: {
            origin: window.location.origin,
            playsinline: 1,
            autoplay: 0,
            controls: 1,
            rel: 0,
            start: Math.floor(initialPosition),
          },
          events: {
            onReady: () => {
              playerReady = true
              if (!cancelled) setReady(true)
            },
            onStateChange: (event) => {
              if (cancelled) return
              sample()
              if (event.data === 1) start()
              else if (event.data === 0 || event.data === 2)
                void flush(event.data === 0)
            },
            onError: (event) => {
              if (cancelled) return
              setError(
                event.data === 101 || event.data === 150
                  ? "The owner has disabled embedded playback for this video."
                  : event.data === 100
                    ? "This video is private, removed, or unavailable."
                    : event.data === 153
                      ? "YouTube could not identify this player. Try reloading the page."
                      : "YouTube could not play this video."
              )
              sample()
              void flush()
            },
          },
        })
      })
      .catch((reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : "YouTube could not load."
          )
      })
    const timer = window.setInterval(sample, 1000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
      player.current?.destroy()
      player.current = null
    }
  }, [videoId, initialPosition, observe, start, flush, attempt])
  return (
    <div className="overflow-hidden rounded-xl bg-[#0d1726] text-white shadow-2xl">
      <div className="relative aspect-video min-h-[200px] [&_iframe]:h-full [&_iframe]:w-full">
        <div ref={container} className="h-full w-full" />
        {!ready && !error ? (
          <p
            role="status"
            className="pointer-events-none absolute inset-0 grid place-items-center"
          >
            Loading YouTube player…
          </p>
        ) : null}
      </div>
      {error ? (
        <div role="alert" className="p-5">
          <p>{error}</p>
          <button
            className="gv-action mt-3"
            onClick={() => {
              setError("")
              setReady(false)
              setAttempt((value) => value + 1)
            }}
          >
            Retry
          </button>
          <a
            className="ml-4 underline"
            href={`https://www.youtube.com/watch?v=${videoId}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            Watch on YouTube
          </a>
        </div>
      ) : null}
      <p className="px-4 py-3 text-xs text-white/70">
        YouTube playback{tracking.saveError ? ` · ${tracking.saveError}` : ""}
      </p>
    </div>
  )
}
