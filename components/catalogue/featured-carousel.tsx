"use client"
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import Link from "next/link"
import { ArrowLeft, ArrowRight, Pause, Play, Info } from "lucide-react"
import { ContentArtwork } from "./content-artwork"
import { TrailerDialog } from "./trailer-dialog"
export type FeaturedSlide = {
  id: string
  slug: string
  title: string
  shortDescription: string
  backdropUrl: string | null
  posterUrl: string | null
  classification: string | null
  releaseYear: number | null
  contentType: string
  assetId: string | null
  trailerId: string | null
  isFeatured: boolean
}
function subscribeEnvironment(notify: () => void) {
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)")
  motion.addEventListener("change", notify)
  document.addEventListener("visibilitychange", notify)
  return () => {
    motion.removeEventListener("change", notify)
    document.removeEventListener("visibilitychange", notify)
  }
}
export function FeaturedCarousel({ items }: { items: FeaturedSlide[] }) {
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [hover, setHover] = useState(false)
  const [focused, setFocused] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const touch = useRef<number | null>(null)
  const environmentPaused = useSyncExternalStore(
    subscribeEnvironment,
    () =>
      document.hidden ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => true
  )
  const count = items.length
  const move = useCallback(
    (delta: number) => {
      setIndex((value) => (value + delta + count) % count)
      setPaused(true)
    },
    [count]
  )
  useEffect(() => {
    if (
      count < 2 ||
      paused ||
      hover ||
      focused ||
      dialogOpen ||
      environmentPaused
    )
      return
    const timer = window.setInterval(
      () => setIndex((value) => (value + 1) % count),
      3000
    )
    return () => window.clearInterval(timer)
  }, [count, paused, hover, focused, dialogOpen, environmentPaused])
  const activeIndex = count ? index % count : 0
  const item = items[activeIndex]
  if (!item)
    return (
      <section className="gv-container py-24 text-center">
        <h1 className="text-4xl font-extrabold">Discover GhanaVerse</h1>
        <p className="mt-4 text-muted-foreground">
          No titles are available for this profile yet.
        </p>
      </section>
    )
  return (
    <section
      aria-roledescription="carousel"
      aria-label="Featured GhanaVerse titles"
      className="relative isolate overflow-hidden bg-slate-950 text-white"
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false)
      }}
      onKeyDown={(event) => {
        if (dialogOpen || count < 2) return
        if (event.key === "ArrowLeft") {
          event.preventDefault()
          move(-1)
        }
        if (event.key === "ArrowRight") {
          event.preventDefault()
          move(1)
        }
      }}
      onTouchStart={(event) => {
        touch.current = event.touches[0].clientX
      }}
      onTouchEnd={(event) => {
        const start = touch.current
        touch.current = null
        if (
          start !== null &&
          count > 1 &&
          Math.abs(event.changedTouches[0].clientX - start) > 60
        )
          move(event.changedTouches[0].clientX < start ? 1 : -1)
      }}
    >
      <div className="absolute inset-0">
        <ContentArtwork
          key={item.id}
          src={item.backdropUrl}
          alt=""
          variant="backdrop"
          priority={activeIndex === 0}
          sizes="100vw"
          className="gv-hero-backdrop-enter"
        />
      </div>
      <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/65 to-black/20" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
      <div
        className="gv-container gv-hero-content-enter relative flex min-h-[480px] items-center py-12 md:min-h-[540px] md:py-16"
        role="group"
        aria-roledescription="slide"
        aria-label={`${activeIndex + 1} of ${count}`}
        key={item.id}
      >
        <div className="max-w-2xl">
          <span className="rounded-full bg-amber-500 px-3 py-1 text-[10px] font-extrabold tracking-widest text-black uppercase">
            {item.isFeatured
              ? "Featured GhanaVerse selection"
              : "Discover Ghanaian stories"}
          </span>
          <p className="mt-5 text-xs font-semibold text-white/80">
            {[
              item.releaseYear,
              item.classification,
              item.contentType.replaceAll("_", " "),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
            {item.title}
          </h1>
          <p className="mt-5 line-clamp-3 max-w-xl text-base leading-7 text-white/80 md:text-lg">
            {item.shortDescription}
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <Link
              href={
                item.assetId ? `/watch/${item.assetId}` : `/title/${item.slug}`
              }
              className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-white"
            >
              {item.assetId ? (
                <Play className="h-4 w-4" />
              ) : (
                <Info className="h-4 w-4" />
              )}
              {item.assetId ? "Start Watching" : "View Details"}
            </Link>
            {item.trailerId ? (
              <TrailerDialog
                key={item.id}
                videoId={item.trailerId}
                title={item.title}
                onOpenChange={setDialogOpen}
              />
            ) : null}
          </div>
        </div>
      </div>
      {count > 1 ? (
        <div className="gv-container relative pb-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <p
              className="text-xs text-white/70"
              aria-live={paused ? "polite" : "off"}
            >
              {activeIndex + 1} / {count} · {item.title}
            </p>
            <div className="flex gap-2">
              <button
                aria-label="Previous featured title"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/40 hover:bg-white/15"
                onClick={() => move(-1)}
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <button
                aria-label={
                  paused ? "Play featured rotation" : "Pause featured rotation"
                }
                aria-pressed={paused}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/40 hover:bg-white/15"
                onClick={() => setPaused((value) => !value)}
              >
                {paused ? (
                  <Play className="h-4 w-4" />
                ) : (
                  <Pause className="h-4 w-4" />
                )}
              </button>
              <button
                aria-label="Next featured title"
                className="grid h-10 w-10 place-items-center rounded-full border border-white/40 hover:bg-white/15"
                onClick={() => move(1)}
              >
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="gv-scroll flex snap-x gap-3 overflow-x-auto pb-2">
            {items.map((slide, position) => (
              <button
                key={slide.id}
                aria-label={`Show featured title: ${slide.title}`}
                aria-pressed={position === activeIndex}
                onClick={() => {
                  setIndex(position)
                  setPaused(true)
                }}
                className={`flex w-52 shrink-0 snap-start items-center gap-3 rounded-lg border p-2 text-left transition sm:w-60 ${position === activeIndex ? "border-amber-400 bg-white/15 ring-1 ring-amber-400" : "border-white/20 bg-black/20 hover:bg-white/10"}`}
              >
                <span className="relative aspect-video w-20 shrink-0 overflow-hidden rounded">
                  <ContentArtwork
                    src={slide.backdropUrl ?? slide.posterUrl}
                    alt=""
                    variant="landscape"
                  />
                </span>
                <span className="line-clamp-2 text-xs font-bold">
                  {slide.title}
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  )
}
