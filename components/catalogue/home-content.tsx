import { ContentRow } from "@/components/catalogue/content-row"
import { LandscapeCard } from "@/components/catalogue/landscape-card"
import { isPermittedPlaybackAsset } from "@/lib/image-policy"
import { FeaturedCarousel } from "./featured-carousel"
import { selectPlaybackAsset } from "@/lib/series"
import { getHomeData } from "@/lib/viewer-data"
import { getOptionalUser } from "@/lib/auth/access"
import { premiumCatalogueAccess } from "@/services/billing/access"

const allowedAsset = (
  content: {
    id: string
    isPremium: boolean
    videoAssets: Array<{
      id: string
      isPlayable: boolean
      sourceType: string
      playbackUrl: string | null
      storedObject?: { state: string } | null
    }>
  },
  allowed: Set<string>
) =>
  content.isPremium && !allowed.has(content.id)
    ? undefined
    : selectPlaybackAsset(
        content.videoAssets.filter(
          (a) => !content.isPremium || a.sourceType === "MANAGED"
        )
      )

export default async function Home() {
  const { content, collections, featured, viewer } = await getHomeData()
  const user = await getOptionalUser()
  const allowed = await premiumCatalogueAccess(user?.user.id, [
    ...content,
    ...(viewer?.watchlist.map((i) => i.content) ?? []),
    ...(viewer?.progress.flatMap((i) =>
      i.content ? [i.content] : i.episode ? [i.episode.season.series] : []
    ) ?? []),
  ])
  if (!featured)
    return (
      <section className="gv-container py-24 text-center">
        <h1 className="text-4xl font-extrabold">GhanaVerse</h1>
        <p className="mt-3 text-muted-foreground">
          {viewer?.profile?.isKids
            ? "No U or PG titles are available for this profile yet."
            : "The catalogue is being prepared."}
        </p>
      </section>
    )
  const selected = content.filter((item) => item.isFeatured)
  const slides = (
    selected.length
      ? selected
      : [...content].sort(
          (a, b) =>
            (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0)
        )
  )
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      slug: item.slug,
      title: item.title,
      shortDescription: item.shortDescription,
      backdropUrl: item.backdropUrl,
      posterUrl: item.posterUrl,
      classification: item.classification,
      releaseYear: item.releaseYear,
      contentType: item.contentType,
      assetId: allowedAsset(item, allowed)?.id ?? null,
      trailerId: item.trailer?.youtubeVideoId ?? null,
      isFeatured: item.isFeatured,
    }))
  return (
    <>
      <FeaturedCarousel key={viewer?.profile?.id ?? "guest"} items={slides} />
      <div className="gv-container pb-8">
        {viewer?.progress.length ? (
          <section className="mt-10">
            <p className="text-[10px] font-bold tracking-[.16em] text-primary uppercase">
              Pick up where you left off
            </p>
            <h2 className="mt-1 text-2xl font-extrabold">
              Continue Watching
              {viewer.profile ? ` for ${viewer.profile.name}` : ""}
            </h2>
            <div className="gv-scroll mt-5 grid auto-cols-[82%] grid-flow-col gap-4 overflow-x-auto pb-4 sm:auto-cols-[48%] lg:auto-cols-[31%]">
              {viewer.progress.map((item) => {
                const title = item.content ?? item.episode?.season.series
                const asset =
                  (!title?.isPremium || allowed.has(title.id)
                    ? item.episode?.videoAssets.find(isPermittedPlaybackAsset)
                    : undefined) ??
                  (title ? allowedAsset(title, allowed) : undefined)
                const percent = item.durationSeconds
                  ? (item.positionSeconds / item.durationSeconds) * 100
                  : 0
                return title ? (
                  <LandscapeCard
                    key={item.id}
                    title={
                      item.episode
                        ? `${title.title}: ${item.episode.title}`
                        : title.title
                    }
                    subtitle={`${Math.round(percent)}% watched`}
                    image={item.episode?.thumbnailUrl ?? title.backdropUrl}
                    progress={percent}
                    href={asset ? `/watch/${asset.id}` : `/title/${title.slug}`}
                  />
                ) : null
              })}
            </div>
          </section>
        ) : null}
        {viewer?.watchlist.length ? (
          <ContentRow
            title="My List"
            eyebrow={`Selected for ${viewer.profile?.name ?? "you"}`}
            items={viewer.watchlist.map(({ content: item }) => item)}
            href="/library"
          />
        ) : null}
        {viewer?.recommendations.length ? (
          <ContentRow
            title="Recommended for You"
            eyebrow="Based on your library and viewing"
            items={viewer.recommendations}
          />
        ) : null}
        {collections.map((collection) => (
          <ContentRow
            key={collection.id}
            title={collection.name}
            eyebrow={collection.description ?? undefined}
            items={collection.items
              .map(({ content: item }) => item)
              .filter((item) => item.publicationStatus === "PUBLISHED")}
          />
        ))}
        <ContentRow
          title="Trending Across Ghana"
          eyebrow="Curated Ghanaian stories"
          items={content.slice(0, 12)}
        />
        <ContentRow
          title="Movies"
          items={content
            .filter((item) => item.contentType === "MOVIE")
            .slice(0, 12)}
          href="/browse?type=MOVIE"
        />
        <ContentRow
          title="Series & Episodic Sagas"
          items={content
            .filter((item) => item.contentType === "SERIES")
            .slice(0, 12)}
          href="/browse?type=SERIES"
        />
        <ContentRow
          title="Documentaries & Heritage"
          items={content
            .filter((item) =>
              ["DOCUMENTARY", "CULTURAL_PROGRAMME"].includes(item.contentType)
            )
            .slice(0, 12)}
          href="/browse?type=DOCUMENTARY"
        />
      </div>
    </>
  )
}
