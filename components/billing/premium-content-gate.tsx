import Link from "@/components/common/app-link"
import { ContentArtwork } from "@/components/catalogue/content-artwork"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { PremiumBadge } from "./premium-badge"

export function PremiumContentGate({
  title,
  posterUrl,
}: {
  title: string
  posterUrl: string | null
}) {
  return (
    <section
      aria-label={`Premium access for ${title}`}
      className="flex flex-col gap-6 rounded-2xl border border-amber-400/60 bg-slate-950 p-6 text-white shadow-xl sm:flex-row sm:items-center md:p-8"
    >
      <div className="relative aspect-[2/3] w-28 shrink-0 overflow-hidden rounded-lg border border-white/20 sm:w-36">
        <ContentArtwork src={posterUrl} alt={`${title} poster`} sizes="144px" />
      </div>
      <div className="min-w-0 space-y-3">
        <PremiumBadge />
        <h2 className="flex items-center gap-2 text-xl font-extrabold md:text-2xl">
          <MaterialSymbol icon="lock" className="text-amber-300" />
          Premium Pass required
        </h2>
        <p className="text-lg font-bold text-amber-200">{title}</p>
        <p className="max-w-xl text-sm leading-6 text-slate-300">
          This is a Premium title. Get or renew your GhanaVerse Premium Pass to
          watch available licensed Premium content with your account.
        </p>
        <Link
          href="/plans"
          className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-amber-400 px-5 py-3 text-sm font-extrabold text-slate-950 hover:bg-amber-300 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-300"
        >
          View Premium Pass{" "}
          <MaterialSymbol icon="arrow_forward" className="text-lg" />
        </Link>
      </div>
    </section>
  )
}
