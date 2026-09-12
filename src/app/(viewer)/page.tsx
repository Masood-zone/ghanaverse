import { Info, Play } from "lucide-react";
import Link from "next/link";
import { ContentArtwork } from "@/components/catalogue/content-artwork";
import { ContentRow } from "@/components/catalogue/content-row";
import { LandscapeCard } from "@/components/catalogue/landscape-card";
import { TrailerDialog } from "@/components/catalogue/trailer-dialog";
import { getHomeData } from "@/lib/viewer-data";

const allowedAsset = (content: { isPremium: boolean; videoAssets: Array<{ id: string; isPlayable: boolean; sourceType: string }> }) => content.isPremium ? undefined : content.videoAssets.find((asset) => asset.isPlayable && asset.sourceType !== "MANAGED");

export default async function Home() {
  const { content, collections, featured, viewer } = await getHomeData();
  if (!featured) return <section className="gv-container py-24 text-center"><h1 className="text-4xl font-extrabold">GhanaVerse</h1><p className="mt-3 text-muted-foreground">The catalogue is being prepared.</p></section>;
  const heroAsset = allowedAsset(featured);
  return <>
    <section className="relative isolate min-h-[520px] overflow-hidden bg-slate-950 text-white"><div className="absolute inset-0"><ContentArtwork src={featured.backdropUrl} alt="" variant="backdrop" priority className="object-cover" /></div><div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/65 to-black/10" /><div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-transparent" /><div className="gv-container relative flex min-h-[520px] items-end py-14 md:items-center md:py-20"><div className="max-w-2xl"><span className="inline-flex rounded-full bg-amber-500/90 px-3 py-1 text-[10px] font-extrabold uppercase tracking-[.15em] text-black">Featured GhanaVerse selection</span><div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-white/85"><span>{featured.releaseYear}</span><span>{featured.classification}</span><span>{featured.contentType.replaceAll("_", " ")}</span>{featured.languages.slice(0, 2).map(({ language }) => <span key={language.id}>{language.name}</span>)}</div><h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">{featured.title}</h1>{featured.tagline ? <p className="mt-3 text-lg italic text-amber-100">“{featured.tagline}”</p> : null}<p className="mt-4 line-clamp-3 max-w-xl text-base leading-7 text-white/80 md:text-lg">{featured.shortDescription}</p><div className="mt-7 flex flex-wrap gap-3">{heroAsset ? <Link href={`/watch/${heroAsset.id}`} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-white hover:bg-primary-hover"><Play className="h-4 w-4 fill-current" />Start Watching</Link> : <Link href={`/title/${featured.slug}`} className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-white"><Info className="h-4 w-4" />View Details</Link>}{featured.trailer ? <TrailerDialog videoId={featured.trailer.youtubeVideoId} title={featured.title} /> : null}</div></div></div></section>
    <div className="gv-container pb-8">
      {viewer?.progress.length ? <section className="mt-10"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">Pick up where you left off</p><h2 className="mt-1 text-2xl font-extrabold">Continue Watching{viewer.profile ? ` for ${viewer.profile.name}` : ""}</h2><div className="gv-scroll mt-5 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto pb-4 sm:auto-cols-[48%] lg:auto-cols-[31%]">{viewer.progress.map((item) => { const title = item.content ?? item.episode?.season.series; const asset = item.episode?.videoAssets.find((entry) => entry.isPlayable && entry.sourceType !== "MANAGED") ?? (title ? allowedAsset(title) : undefined); const percent = item.durationSeconds ? item.positionSeconds / item.durationSeconds * 100 : 0; return title ? <LandscapeCard key={item.id} title={item.episode ? `${title.title}: ${item.episode.title}` : title.title} subtitle={`${Math.round(percent)}% watched`} image={item.episode?.thumbnailUrl ?? title.backdropUrl} progress={percent} href={asset ? `/watch/${asset.id}` : `/title/${title.slug}`} /> : null; })}</div></section> : null}
      {viewer?.watchlist.length ? <ContentRow title="My List" eyebrow={`Selected for ${viewer.profile?.name ?? "you"}`} items={viewer.watchlist.map(({ content: item }) => item)} href="/library" /> : null}
      {viewer?.recommendations.length ? <ContentRow title="Recommended for You" eyebrow="Based on your library and viewing" items={viewer.recommendations} /> : null}
      {collections.map((collection) => <ContentRow key={collection.id} title={collection.name} eyebrow={collection.description ?? undefined} items={collection.items.map(({ content: item }) => item).filter((item) => item.publicationStatus === "PUBLISHED")} />)}
      <ContentRow title="Trending Across Ghana" eyebrow="Curated Ghanaian stories" items={content.slice(0, 12)} />
      <ContentRow title="Movies" items={content.filter((item) => item.contentType === "MOVIE").slice(0, 12)} href="/browse?type=MOVIE" />
      <ContentRow title="Series & Episodic Sagas" items={content.filter((item) => item.contentType === "SERIES").slice(0, 12)} href="/browse?type=SERIES" />
      <ContentRow title="Documentaries & Heritage" items={content.filter((item) => ["DOCUMENTARY", "CULTURAL_PROGRAMME"].includes(item.contentType)).slice(0, 12)} href="/browse?type=DOCUMENTARY" />
    </div>
  </>;
}
