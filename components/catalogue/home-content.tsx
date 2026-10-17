import { Suspense } from "react"
import { ContentRow } from "@/components/catalogue/content-row"
import { LandscapeCard } from "@/components/catalogue/landscape-card"
import { isPermittedPlaybackAsset } from "@/lib/image-policy"
import { FeaturedCarousel } from "./featured-carousel"
import { selectPlaybackAsset } from "@/lib/series"
import {
  getHomeCatalogue,
  getHomeViewer,
  libraryContentSelect,
} from "@/lib/viewer-data"
import { getViewerContext } from "@/lib/viewer-context"
import { getPrisma } from "@/lib/prisma"
import { viewerContentWhere } from "@/lib/viewer-policy"
import { premiumCatalogueAccess } from "@/services/billing/access"
import { RouteSkeleton } from "@/components/common/route-skeleton"

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

type Context = Awaited<ReturnType<typeof getViewerContext>>
type Shared = Awaited<ReturnType<typeof getHomeCatalogue>>
export default async function Home() {
  const context = await getViewerContext()
  const shared = await getHomeCatalogue(context.profile?.isKids ?? false)
  const { content, collections, featured } = shared
  if (!featured)
    return (
      <section className="gv-container py-24 text-center">
        <h1 className="text-4xl font-extrabold">GhanaVerse</h1>
        <p className="mt-3 text-muted-foreground">
          {context.profile?.isKids
            ? "No U or PG titles are available for this profile yet."
            : "The catalogue is being prepared."}
        </p>
      </section>
    )
  return (
    <>
      <Suspense fallback={<RouteSkeleton kind="home" />}>
        <HomeHero shared={shared} context={context} />
      </Suspense>
      <div className="gv-container pb-8">
        {context.access ? (
          <Suspense
            fallback={
              <div
                className="gv-skeleton mt-10 h-40 rounded-lg"
                aria-label="Loading your library"
              />
            }
          >
            <PersonalSections context={context} content={content} />
          </Suspense>
        ) : null}
        {collections.map((collection) => (
          <ContentRow
            key={collection.id}
            title={collection.name}
            eyebrow={collection.description ?? undefined}
            items={collection.items.map(({ content: item }) => item)}
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
async function HomeHero({
  shared,
  context,
}: {
  shared: Shared
  context: Context
}) {
  // Media eligibility and premium access are never read from the shared cache.
  const media = await getPrisma().content.findMany({
    where: {
      id: { in: shared.heroes.map((item) => item.id) },
      publicationStatus: "PUBLISHED",
      ...viewerContentWhere(context.profile),
    },
    select: libraryContentSelect,
  })
  const allowed = await premiumCatalogueAccess(context.access?.user.id, media)
  const slides = shared.heroes
    .filter((item) => media.some((current) => current.id === item.id))
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
      isFeatured: item.isFeatured,
      isPremium: item.isPremium,
      assetId:
        allowedAsset(
          media.find((current) => current.id === item.id)!,
          allowed
        )?.id ?? null,
      trailerId: item.trailer?.youtubeVideoId ?? null,
    }))
  return (
    <FeaturedCarousel key={context.profile?.id ?? "guest"} items={slides} />
  )
}
async function PersonalSections({
  context,
  content,
}: {
  context: Context
  content: Shared["content"]
}) {
  const viewer = await getHomeViewer(context, content)
  const titles = [
    ...(viewer?.watchlist.map((item) => item.content) ?? []),
    ...(viewer?.progress.flatMap((item) =>
      item.content
        ? [item.content]
        : item.episode
          ? [item.episode.season.series]
          : []
    ) ?? []),
  ]
  const allowed = await premiumCatalogueAccess(context.access?.user.id, titles)
  return (
    <>
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
                  isPremium={title.isPremium}
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
    </>
  )
}
