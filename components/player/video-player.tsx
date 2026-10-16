"use client"
import {
  Expand,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "@/components/common/icons"
import { useCallback, useEffect, useRef, useState } from "react"
import { resolvePlaybackSource } from "@/lib/playback-source"
import { usePlaybackTracking } from "./use-playback-tracking"
import { YouTubePlayer } from "./youtube-player"
type Props = {
  assetId: string
  src: string
  sourceType: string
  poster?: string | null
  initialPosition?: number
}
export function VideoPlayer(props: Props) {
  const source = resolvePlaybackSource(props.sourceType, props.src)
  if (!source)
    return (
      <div role="alert" className="gv-panel">
        This playback source is not supported.
      </div>
    )
  return source.kind === "youtube" ? (
    <YouTubePlayer
      key={props.assetId}
      assetId={props.assetId}
      videoId={source.videoId}
      initialPosition={props.initialPosition}
    />
  ) : (
    <NativePlayer key={props.assetId} {...props} src={source.url} />
  )
}
function NativePlayer({ assetId, src, poster, initialPosition = 0 }: Props) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false)
  const [position, setPosition] = useState(initialPosition),
    [duration, setDuration] = useState(0)
  const [error, setError] = useState(""),
    [loading, setLoading] = useState(true)
  const { observe, start, flush, saveError } = usePlaybackTracking(assetId)
  const attach = useCallback(
    (video: HTMLVideoElement | null) => {
      ref.current = video
      if (!video) return
      // The browser can finish metadata loading (or fail) before hydration attaches handlers.
      if (video.error) {
        setLoading(false)
        setError(
          "The video source is unavailable or unsupported. Use a direct video-file URL rather than a webpage."
        )
      }
      if (video.readyState >= 1 && Number.isFinite(video.duration)) {
        setDuration(video.duration)
        setLoading(false)
        if (initialPosition > 0 && initialPosition < video.duration)
          video.currentTime = initialPosition
      }
    },
    [initialPosition]
  )
  const sample = (video: HTMLVideoElement, active: boolean, seeking = false) =>
    observe({
      position: video.currentTime,
      duration: Number.isFinite(video.duration) ? video.duration : 0,
      rate: video.playbackRate,
      playing: active,
      seeking,
      visible: true,
    })
  useEffect(() => {
    const timer = window.setInterval(() => {
      const video = ref.current
      if (video)
        observe({
          position: video.currentTime,
          duration: Number.isFinite(video.duration) ? video.duration : 0,
          rate: video.playbackRate,
          playing:
            !video.paused &&
            !video.seeking &&
            video.readyState >= 3 &&
            !video.ended,
          seeking: video.seeking,
          visible: true,
        })
    }, 1000)
    return () => window.clearInterval(timer)
  }, [observe])
  const toggle = async () => {
    const video = ref.current
    if (!video) return
    try {
      if (video.paused) await video.play()
      else video.pause()
    } catch {
      setError(
        "This video could not start. Check that the URL points to a browser-supported video file."
      )
    }
  }
  const seek = (seconds: number) => {
    const video = ref.current
    if (video && duration)
      video.currentTime = Math.max(
        0,
        Math.min(duration, video.currentTime + seconds)
      )
  }
  return (
    <div className="overflow-hidden rounded-xl bg-[#0d1726] text-white shadow-2xl">
      <div className="relative aspect-video bg-black">
        <video
          ref={attach}
          src={src}
          poster={poster ?? undefined}
          preload="metadata"
          playsInline
          className="h-full w-full object-contain"
          onLoadedMetadata={(event) => {
            const video = event.currentTarget,
              length = Number.isFinite(video.duration) ? video.duration : 0
            setDuration(length)
            setLoading(false)
            if (initialPosition > 0 && initialPosition < length)
              video.currentTime = initialPosition
          }}
          onTimeUpdate={(event) => setPosition(event.currentTarget.currentTime)}
          onDurationChange={(event) => {
            const length = event.currentTarget.duration
            if (Number.isFinite(length) && length > 0) setDuration(length)
          }}
          onPlaying={(event) => {
            setPlaying(true)
            setLoading(false)
            setError("")
            sample(event.currentTarget, true)
            start()
          }}
          onWaiting={(event) => {
            setLoading(true)
            sample(event.currentTarget, false)
          }}
          onSeeking={(event) => sample(event.currentTarget, false, true)}
          onSeeked={(event) =>
            sample(event.currentTarget, !event.currentTarget.paused)
          }
          onCanPlay={() => setLoading(false)}
          onPause={(event) => {
            setPlaying(false)
            sample(event.currentTarget, false)
            void flush()
          }}
          onEnded={(event) => {
            setPlaying(false)
            sample(event.currentTarget, false)
            void flush(true)
          }}
          onError={(event) => {
            setPlaying(false)
            setLoading(false)
            sample(event.currentTarget, false)
            setError(
              "The video source is unavailable or unsupported. Use a direct video-file URL rather than a webpage."
            )
            void flush()
          }}
        />
        {!error ? (
          <button
            onClick={() => void toggle()}
            aria-label={playing ? "Pause" : "Play"}
            className="absolute inset-0 grid place-items-center text-white opacity-0 transition hover:bg-black/10 hover:opacity-100 focus-visible:opacity-100"
          >
            <span className="grid h-16 w-16 place-items-center rounded-full bg-white/95 text-slate-950 shadow-xl">
              {playing ? (
                <Pause className="h-7 w-7 fill-current" />
              ) : (
                <Play className="ml-1 h-7 w-7 fill-current" />
              )}
            </span>
          </button>
        ) : null}
        {loading ? (
          <p
            role="status"
            className="pointer-events-none absolute inset-x-0 top-4 text-center text-sm"
          >
            Loading video…
          </p>
        ) : null}
      </div>
      <div className="bg-gradient-to-b from-[#17263a] to-[#0d1726] p-4">
        <input
          aria-label="Playback position"
          type="range"
          min={0}
          max={duration || 1}
          disabled={!duration}
          value={Math.min(position, duration || 1)}
          onChange={(event) => {
            const value = Number(event.target.value)
            if (ref.current) ref.current.currentTime = value
            setPosition(value)
          }}
          onPointerUp={() => void flush()}
          onKeyUp={() => void flush()}
          className="h-1 w-full accent-amber-500"
        />
        <div className="mt-3 flex items-center gap-2">
          <Control
            label={playing ? "Pause" : "Play"}
            onClick={() => void toggle()}
          >
            {playing ? <Pause /> : <Play />}
          </Control>
          <Control label="Back 10 seconds" onClick={() => seek(-10)}>
            <RotateCcw />
          </Control>
          <Control label="Forward 10 seconds" onClick={() => seek(10)}>
            <RotateCw />
          </Control>
          <Control
            label={muted ? "Unmute" : "Mute"}
            onClick={() => {
              if (ref.current) ref.current.muted = !muted
              setMuted(!muted)
            }}
          >
            {muted ? <VolumeX /> : <Volume2 />}
          </Control>
          <span className="ml-2 text-xs text-white/70">
            {formatTime(position)} / {formatTime(duration)}
          </span>
          <Control
            label="Fullscreen"
            className="ml-auto"
            onClick={() => {
              void ref.current
                ?.requestFullscreen()
                .catch(() =>
                  setError("Fullscreen is unavailable in this browser.")
                )
            }}
          >
            <Expand />
          </Control>
        </div>
      </div>
      {error ? (
        <div role="alert" className="p-4 text-sm">
          <p>{error}</p>
          <button
            className="gv-action mt-3"
            onClick={() => {
              setError("")
              setLoading(true)
              ref.current?.load()
            }}
          >
            Retry
          </button>
        </div>
      ) : null}
      {saveError ? (
        <p role="status" className="px-4 pb-4 text-xs text-amber-200">
          {saveError}
        </p>
      ) : null}
    </div>
  )
}
function Control({
  label,
  onClick,
  children,
  className = "",
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      className={`grid h-9 w-9 place-items-center rounded-md hover:bg-white/10 [&>svg]:h-4 [&>svg]:w-4 ${className}`}
    >
      {children}
    </button>
  )
}
function formatTime(value: number) {
  if (!Number.isFinite(value)) return "0:00"
  return `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, "0")}`
}
