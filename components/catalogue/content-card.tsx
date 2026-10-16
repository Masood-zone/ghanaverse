import { Star } from "@/components/common/icons"
import { WatchlistButton } from "./watchlist-button"
import Link from "next/link"
import { ContentArtwork } from "@/components/catalogue/content-artwork"

export type CatalogueCardItem = {
  id?: string
  slug: string
  title: string
  shortDescription?: string
  contentType: string
  releaseYear: number | null
  runtimeMinutes?: number | null
  classification?: string | null
  posterUrl?: string | null
  sourceRating?: number | null
  genres: { genre: { name: string } }[]
  languages?: { language: { name: string } }[]
}
const label = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export function ContentCard({
  item,
  compact = false,
}: {
  item: CatalogueCardItem
  compact?: boolean
}) {
  const meta = [
    item.releaseYear,
    item.runtimeMinutes && `${item.runtimeMinutes}m`,
    item.genres[0]?.genre.name,
  ]
    .filter(Boolean)
    .join(" · ")
  return (
    <div className="group relative block min-w-0 snap-start">
      <Link
        href={`/title/${item.slug}`}
        className="block rounded-lg focus-visible:outline-2 focus-visible:outline-primary"
      >
        <article className="overflow-hidden rounded-lg border bg-white transition duration-200 group-hover:-translate-y-1 group-hover:shadow-lg">
          <div className="relative aspect-[2/3] overflow-hidden bg-muted">
            <ContentArtwork src={item.posterUrl} alt={`${item.title} poster`} />
            <div className="absolute inset-x-0 top-0 flex items-start justify-between p-2">
              <span className="rounded bg-white/95 px-2 py-1 text-[10px] font-bold text-slate-800 shadow-sm">
                {item.classification ?? label(item.contentType)}
              </span>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex items-end justify-between bg-gradient-to-t from-black/80 to-transparent p-3 pt-12 text-white">
              <span className="text-[10px] font-bold tracking-wide uppercase">
                {label(item.contentType)}
              </span>
              {item.sourceRating ? (
                <span className="flex items-center gap-1 text-xs">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  {item.sourceRating.toFixed(1)}
                </span>
              ) : null}
            </div>
          </div>
          <div className={compact ? "p-3" : "p-4"}>
            <h3 className="truncate font-bold text-slate-950">{item.title}</h3>
            <p className="mt-1 truncate text-xs text-muted-foreground">
              {meta}
            </p>
            {!compact && item.shortDescription ? (
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-600">
                {item.shortDescription}
              </p>
            ) : null}
          </div>
        </article>
      </Link>
      {item.id ? (
        <div className="absolute top-2 right-2">
          <WatchlistButton contentId={item.id} title={item.title} compact />
        </div>
      ) : null}
    </div>
  )
}
