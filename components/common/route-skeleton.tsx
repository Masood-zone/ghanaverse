import { RoutePending } from "@/components/providers/navigation-loading"
import { cn } from "@/lib/utils"

export type RouteSkeletonKind =
  | "home"
  | "catalogue"
  | "title"
  | "library"
  | "account"
  | "plans"
  | "workspace"
  | "player"

function Block({ className }: { className: string }) {
  return <div className={cn("gv-skeleton rounded-lg", className)} />
}

function Cards({ landscape = false }: { landscape?: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: 5 }, (_, index) => (
        <div key={index} className="space-y-3">
          <Block className={landscape ? "aspect-video" : "aspect-[2/3]"} />
          <Block className="h-4 w-4/5" />
          <Block className="h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

function Hero() {
  return (
    <div className="relative bg-slate-950 text-white">
      <Block className="aspect-[16/10] rounded-none bg-white/10 md:absolute md:inset-0 md:aspect-auto" />
      <div className="gv-container relative space-y-5 py-8 md:flex md:min-h-[540px] md:flex-col md:justify-center md:py-16 [&>div]:max-w-xl">
        <Block className="h-5 w-40 bg-white/10" />
        <Block className="h-12 w-3/4 bg-white/10" />
        <Block className="h-4 w-full bg-white/10" />
        <Block className="h-4 w-2/3 bg-white/10" />
        <div className="flex gap-3">
          <Block className="h-11 w-40 bg-white/10" />
          <Block className="h-11 w-32 bg-white/10" />
        </div>
      </div>
    </div>
  )
}

function SkeletonContent({ kind }: { kind: RouteSkeletonKind }) {
  if (kind === "home")
    return (
      <>
        <Hero />
        <div className="gv-container space-y-6 py-10">
          <Block className="h-7 w-60" />
          <Cards />
          <Block className="mt-12 h-7 w-52" />
          <Cards landscape />
        </div>
      </>
    )
  if (kind === "player")
    return (
      <div className="min-h-screen bg-slate-950 p-4 md:p-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <Block className="h-8 w-48 bg-white/10" />
          <Block className="aspect-video w-full bg-white/10" />
          <Block className="h-7 w-2/3 bg-white/10" />
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <Block key={index} className="aspect-video bg-white/10" />
            ))}
          </div>
        </div>
      </div>
    )
  if (kind === "title")
    return (
      <>
        <div className="bg-slate-950">
          <div className="gv-container grid min-h-[520px] items-end gap-8 py-12 md:grid-cols-[220px_1fr]">
            <Block className="mx-auto aspect-[2/3] w-44 bg-white/10 md:w-full" />
            <div className="space-y-5">
              <Block className="h-7 w-32 bg-white/10" />
              <Block className="h-14 w-4/5 bg-white/10" />
              <Block className="h-4 w-2/3 bg-white/10" />
              <Block className="h-24 w-full bg-white/10" />
              <Block className="h-11 w-40 bg-white/10" />
            </div>
          </div>
        </div>
        <div className="gv-container py-10">
          <Cards landscape />
        </div>
      </>
    )
  if (kind === "account" || kind === "plans")
    return (
      <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 md:py-14">
        <div className="mx-auto max-w-2xl space-y-4">
          <Block className="mx-auto h-6 w-40" />
          <Block className="mx-auto h-10 w-4/5" />
          <Block className="mx-auto h-4 w-2/3" />
        </div>
        <div
          className={
            kind === "plans"
              ? "grid gap-6 md:grid-cols-2"
              : "grid gap-6 md:grid-cols-[1fr_2fr]"
          }
        >
          {Array.from({ length: 2 }, (_, index) => (
            <div
              key={index}
              className="space-y-5 rounded-xl border bg-white p-6"
            >
              <Block className="h-7 w-1/2" />
              <Block className="h-12 w-full" />
              <Block className="h-12 w-full" />
              <Block className="h-12 w-full" />
              <Block className="mt-6 h-11 w-36" />
            </div>
          ))}
        </div>
      </div>
    )
  if (kind === "workspace")
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <Block className="h-9 w-56" />
          <Block className="h-10 w-32" />
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Block key={index} className="h-28" />
          ))}
        </div>
        <div className="space-y-4 rounded-xl border bg-white p-5">
          <Block className="h-11 w-full" />
          {Array.from({ length: 6 }, (_, index) => (
            <Block key={index} className="h-12 w-full" />
          ))}
        </div>
      </div>
    )
  return (
    <>
      {kind === "catalogue" ? (
        <div className="border-b bg-amber-50 px-4 py-12 md:py-16">
          <div className="mx-auto max-w-2xl space-y-5">
            <Block className="mx-auto h-5 w-48" />
            <Block className="mx-auto h-20 w-4/5" />
            <Block className="h-14 w-full" />
          </div>
        </div>
      ) : null}
      <div className="gv-container space-y-6 py-10">
        <Block className="h-9 w-60" />
        <Block className="h-14 w-full" />
        <Cards />
      </div>
    </>
  )
}

export function RouteSkeleton({
  kind = "workspace",
}: {
  kind?: RouteSkeletonKind
}) {
  return (
    <div
      role="status"
      aria-label={`Loading ${kind === "workspace" ? "workspace" : kind === "title" ? "title details" : kind}`}
      aria-busy="true"
    >
      <RoutePending />
      <span className="sr-only">Loading…</span>
      <div aria-hidden="true">
        <SkeletonContent kind={kind} />
      </div>
    </div>
  )
}
