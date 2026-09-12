import Link from "next/link";
import { ContentArtwork } from "@/components/catalogue/content-artwork";

type Item = { slug: string; title: string; contentType: string; releaseYear: number | null; posterUrl?: string | null; trailer?: { youtubeVideoId: string } | null; genres: { genre: { name: string } }[] };

export function ContentCard({ item }: { item: Item }) {
  return <Link href={`/title/${item.slug}`} className="group block min-w-0"><div className="relative aspect-[2/3] overflow-hidden rounded-xl bg-muted shadow-sm transition group-hover:-translate-y-1 group-hover:shadow-lg"><ContentArtwork src={item.posterUrl} trailerVideoId={item.trailer?.youtubeVideoId} alt={`${item.title} poster`} /><div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent p-4 pt-14"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-white/80">{item.contentType.replaceAll("_", " ")}</p><h3 className="mt-1 text-lg font-extrabold leading-tight text-white">{item.title}</h3></div></div><div className="mt-3"><h3 className="font-bold">{item.title}</h3><p className="mt-1 text-xs text-muted-foreground">{[item.releaseYear, item.genres[0]?.genre.name].filter(Boolean).join(" · ")}</p></div></Link>;
}
