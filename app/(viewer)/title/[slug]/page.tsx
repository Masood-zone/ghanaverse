import { ExternalLink, Film, Play } from "@/components/common/icons"
import Link from "@/components/common/app-link"
import { notFound } from "next/navigation"
import {
  ContentArtwork,
  PersonAvatar,
} from "@/components/catalogue/content-artwork"
import { ContentRow } from "@/components/catalogue/content-row"
import { TrailerDialog } from "@/components/catalogue/trailer-dialog"
import { WatchlistButton } from "@/components/catalogue/watchlist-button"
import { getOptionalUser } from "@/lib/auth/access"
import { getPublishedContent, getPublishedContentBySlug } from "@/lib/catalogue"
import { safeExternalUrl } from "@/lib/image-policy"
import { getPrisma } from "@/lib/prisma"
import { getActiveProfile } from "@/lib/profiles"
import { canViewContent } from "@/lib/viewer-policy"
import { getSeriesViewingData } from "@/services/viewer/series"
import { EpisodeBrowser } from "@/components/player/episode-browser"
import { episodeLabel, selectPlaybackAsset } from "@/lib/series"
import { RestrictedContent } from "@/components/profiles/restricted-content"
import { callbackWithSearch } from "@/lib/auth/callback"
import { premiumAccess, activeLicense } from "@/services/billing/access"
import { PremiumContentGate } from "@/components/billing/premium-content-gate"
import { PremiumBadge } from "@/components/billing/premium-badge"

type WatchLink = {
  url?: string
  service?: string
  provider?: string
  type?: string
}
const display = (value: string) =>
  value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase())

export default async function TitlePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const content = await getPublishedContentBySlug((await params).slug)
  if (!content) notFound()
  const access = await getOptionalUser()
  const profile = access ? await getActiveProfile(access.user.id) : null
  if (!canViewContent(profile, content))
    return (
      <RestrictedContent
        callbackUrl={callbackWithSearch(
          `/title/${content.slug}`,
          await searchParams
        )}
      />
    )
  const saved = profile
    ? Boolean(
        await getPrisma().watchlistItem.findUnique({
          where: {
            profileId_contentId: {
              profileId: profile.id,
              contentId: content.id,
            },
          },
        })
      )
    : false
  const genres = content.genres.map(({ genre }) => genre.name)
  const languages = content.languages.map(({ language }) => language.name)
  const cast = content.credits.filter((credit) => credit.creditType === "CAST")
  const crew = content.credits.filter((credit) => credit.creditType !== "CAST")
  const links = (
    Array.isArray(content.externalWatchLinks) ? content.externalWatchLinks : []
  ) as WatchLink[]
  const [pass, license] = content.isPremium
    ? await Promise.all([
        premiumAccess(access?.user.id),
        activeLicense(content.id, content.rightsHolderId),
      ])
    : [null, null]
  const canPlayPremium = !content.isPremium || Boolean(pass?.active && license)
  const mainAsset = canPlayPremium
    ? selectPlaybackAsset(
        content.videoAssets.filter(
          (a) => !content.isPremium || a.sourceType === "MANAGED"
        )
      )
    : undefined
  const series =
    content.contentType === "SERIES"
      ? await getSeriesViewingData(content, profile?.id)
      : null
  const related = (
    await getPublishedContent({
      genre: content.genres[0]?.genre.slug,
      pageSize: 12,
    })
  )
    .filter((item) => item.id !== content.id)
    .slice(0, 8)
  return (
    <>
      <section className="relative isolate overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0">
          <ContentArtwork
            src={content.backdropUrl}
            alt=""
            variant="backdrop"
            priority
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/75 to-black/20" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent" />
        <div className="gv-container relative grid min-h-[520px] items-end gap-8 py-12 md:grid-cols-[220px_1fr] md:py-16">
          <div className="relative mx-auto aspect-[2/3] w-44 overflow-hidden rounded-lg border-4 border-white/80 shadow-2xl md:mx-0 md:w-full">
            <ContentArtwork
              src={content.posterUrl}
              alt={`${content.title} poster`}
              priority
            />
          </div>
          <div className="pb-2">
            <div className="flex flex-wrap gap-2">
              <span className="rounded bg-primary px-2 py-1 text-[10px] font-extrabold uppercase">
                {display(content.contentType)}
              </span>
              {content.productionCompany ? (
                <span className="rounded bg-white/15 px-2 py-1 text-[10px] font-semibold">
                  {content.productionCompany.name}
                </span>
              ) : null}
            </div>
            <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl">
              {content.title}
            </h1>
            {content.tagline ? (
              <p className="mt-2 text-lg text-amber-100 italic">
                “{content.tagline}”
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
              {[
                content.releaseYear,
                content.runtimeMinutes && `${content.runtimeMinutes} min`,
                content.classification,
                ...genres.slice(0, 3),
              ]
                .filter(Boolean)
                .map((item) => (
                  <span
                    key={String(item)}
                    className="rounded bg-white/15 px-2 py-1"
                  >
                    {item}
                  </span>
                ))}
            </div>
            <p className="mt-5 max-w-3xl text-base leading-7 text-white/85">
              {content.description}
            </p>
            <div className="mt-7 flex flex-wrap gap-3">
              {series?.resume ? (
                <Link
                  href={
                    series.resume.assetId
                      ? `/watch/${series.resume.assetId}`
                      : "#episodes"
                  }
                  className="gv-action"
                >
                  {!series.resume.available
                    ? `${episodeLabel(series.resume)} unavailable · Browse episodes`
                    : `${series.resume.completed ? "Replay" : series.resume.positionSeconds > 0 ? "Resume" : "Play"} ${episodeLabel(series.resume)}`}
                </Link>
              ) : null}
              {mainAsset ? (
                <Link
                  href={`/watch/${mainAsset.id}`}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-5 py-3 text-sm font-bold text-white"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Play Now
                </Link>
              ) : null}
              {content.trailer ? (
                <TrailerDialog
                  videoId={content.trailer.youtubeVideoId}
                  title={content.title}
                />
              ) : null}
              <WatchlistButton
                contentId={content.id}
                slug={content.slug}
                authenticated={Boolean(access)}
                initialSaved={saved}
              />
            </div>
            {content.isPremium ? (
              <div className="mt-6">
                {!license ? (
                  <div className="rounded-xl border border-amber-300/40 bg-slate-900 p-5">
                    <PremiumBadge />
                    <p className="mt-3 font-bold">
                      {content.title} is currently unavailable
                    </p>
                    <p className="mt-2 text-sm text-slate-300">
                      This Premium title does not currently have an active
                      streaming licence.
                    </p>
                  </div>
                ) : canPlayPremium ? (
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-200">
                    <PremiumBadge /> Included in your Premium Pass.
                  </p>
                ) : (
                  <PremiumContentGate
                    title={content.title}
                    posterUrl={content.posterUrl}
                  />
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>
      <div className="gv-container py-10">
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <main className="space-y-7">
            {series ? (
              <EpisodeBrowser
                episodes={series.episodes}
                initialSeasonId={series.resume?.seasonId}
                backdrop={content.backdropUrl}
              />
            ) : null}
            {cast.length + crew.length ? (
              <section className="rounded-xl border bg-white p-5 md:p-7">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-extrabold">
                    Leading Cast &amp; Creatives
                  </h2>
                  <span className="text-xs text-muted-foreground">
                    {cast.length + crew.length} credits
                  </span>
                </div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {[...cast, ...crew].slice(0, 12).map((credit) => (
                    <div
                      key={`${credit.personId}-${credit.creditType}`}
                      className="flex items-center gap-3"
                    >
                      <PersonAvatar
                        name={credit.person.name}
                        src={credit.person.imageUrl}
                        className="h-14 w-14"
                      />
                      <div>
                        <h3 className="text-sm font-bold">
                          {credit.person.name}
                        </h3>
                        <p className="text-xs text-muted-foreground">
                          {credit.characterName || display(credit.creditType)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </main>
          <aside className="space-y-5">
            <section className="rounded-xl border bg-white p-5">
              <h2 className="flex items-center gap-2 font-bold">
                <Film className="h-4 w-4 text-primary" />
                Content Details
              </h2>
              <dl className="mt-5 space-y-4 text-sm">
                {genres.length ? (
                  <Detail label="Genres" value={genres.join(", ")} />
                ) : null}
                {languages.length ? (
                  <Detail label="Languages" value={languages.join(", ")} />
                ) : null}
                {content.classification ? (
                  <Detail
                    label="Classification"
                    value={content.classification}
                  />
                ) : null}
                {content.productionCompany ? (
                  <Detail
                    label="Production"
                    value={content.productionCompany.name}
                  />
                ) : null}
                {content.rightsHolder ? (
                  <Detail
                    label="Rights Holder"
                    value={content.rightsHolder.name}
                  />
                ) : null}
                {content.country ? (
                  <Detail label="Country" value={content.country} />
                ) : null}
              </dl>
            </section>
            {links.some((link) => safeExternalUrl(link.url)) ? (
              <section className="rounded-xl border border-amber-200 bg-amber-50 p-5">
                <h2 className="font-bold">Available on</h2>
                <div className="mt-4 grid gap-2">
                  {links.flatMap((link, index) => {
                    const url = safeExternalUrl(link.url)
                    return url
                      ? [
                          <a
                            key={`${url}-${index}`}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center justify-between rounded-md bg-white px-3 py-2 text-sm font-semibold text-primary"
                          >
                            Watch on{" "}
                            {link.service ?? link.provider ?? "provider"}
                            <ExternalLink className="h-4 w-4" />
                          </a>,
                        ]
                      : []
                  })}
                </div>
                <p className="mt-3 text-xs leading-5 text-muted-foreground">
                  External availability is not GhanaVerse playback.
                </p>
              </section>
            ) : null}
          </aside>
        </div>
        <ContentRow
          title="More Like This"
          eyebrow="Related Ghanaian stories"
          items={related}
        />
      </div>
    </>
  )
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-slate-800">{value}</dd>
    </div>
  )
}
