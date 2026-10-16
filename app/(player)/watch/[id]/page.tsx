import {
  AlertTriangle,
  ArrowLeft,
  LockKeyhole,
} from "@/components/common/icons"
import Link from "next/link"
import { notFound } from "next/navigation"
import { PersonAvatar } from "@/components/catalogue/content-artwork"
import { SeriesPlayer } from "@/components/player/series-player"
import { getSeriesViewingData } from "@/services/viewer/series"
import { canViewContent } from "@/lib/viewer-policy"
import { RestrictedContent } from "@/components/profiles/restricted-content"
import { VideoPlayer } from "@/components/player/video-player"
import { catalogueInclude } from "@/lib/catalogue"
import { requireUserPage } from "@/lib/auth/access"
import { isPermittedPlaybackAsset } from "@/lib/image-policy"
import { getPrisma } from "@/lib/prisma"
import { getActiveProfile } from "@/lib/profiles"
import { callbackWithSearch } from "@/lib/auth/callback"

export default async function WatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  const callbackUrl = callbackWithSearch(`/watch/${id}`, query)
  const { user } = await requireUserPage(callbackUrl)
  const profile = await getActiveProfile(user.id)
  const asset = await getPrisma().videoAsset.findUnique({
    where: { id },
    include: {
      content: { include: catalogueInclude },
      episode: {
        include: {
          season: { include: { series: { include: catalogueInclude } } },
        },
      },
    },
  })
  if (!asset) notFound()
  const content = asset.content ?? asset.episode?.season.series
  if (!content || content.publicationStatus !== "PUBLISHED") notFound()
  if (!canViewContent(profile, content))
    return <RestrictedContent callbackUrl={callbackUrl} />
  const permitted = isPermittedPlaybackAsset(asset)
  const premium = content.isPremium
  const progress = profile
    ? await getPrisma().watchProgress.findFirst({
        where: {
          profileId: profile.id,
          ...(asset.episodeId
            ? { episodeId: asset.episodeId }
            : { contentId: asset.contentId }),
        },
        orderBy: { lastWatchedAt: "desc" },
      })
    : null
  const navigation = asset.episode
    ? await getSeriesViewingData(content, profile?.id, asset.episode.id)
    : null
  const title = asset.episode
    ? `${content.title} — S${asset.episode.season.seasonNumber}:E${asset.episode.episodeNumber} “${asset.episode.title}”`
    : content.title
  return (
    <main className="min-h-screen bg-[#f7f6f2] pb-16">
      <div className="bg-[#0d1726] text-white">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-8">
          <Link
            href={`/title/${content.slug}`}
            className="inline-flex items-center gap-2 text-sm font-semibold text-white/75 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to {content.title}
          </Link>
          <span className="text-xs font-bold tracking-[.16em] text-amber-400 uppercase">
            GhanaVerse Player
          </span>
        </div>
      </div>
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-8">
        {premium ? (
          <PlayerState
            icon={<LockKeyhole />}
            title="Premium playback is not available yet"
            body="This title requires a subscription. Premium playback is currently unavailable."
          />
        ) : !permitted ? (
          <PlayerState
            icon={<AlertTriangle />}
            title="Playback is not permitted for this asset"
            body="This title needs an enabled, supported playback source."
          />
        ) : navigation ? (
          <SeriesPlayer
            key={`${profile?.id}:${asset.id}`}
            player={{
              assetId: asset.id,
              sourceType: asset.sourceType,
              src: asset.playbackUrl,
              poster: asset.episode?.thumbnailUrl ?? content.backdropUrl,
              initialPosition: progress?.completed
                ? 0
                : (progress?.positionSeconds ?? 0),
              profileId: profile?.id,
              preferSubtitles: profile?.preferSubtitles,
            }}
            navigation={navigation}
            autoplayNextEpisode={profile?.autoplayNextEpisode ?? false}
            backdrop={content.backdropUrl}
          />
        ) : (
          <VideoPlayer
            key={`${profile?.id}:${asset.id}`}
            assetId={asset.id}
            sourceType={asset.sourceType}
            src={asset.playbackUrl}
            poster={content.backdropUrl}
            initialPosition={
              progress?.completed ? 0 : (progress?.positionSeconds ?? 0)
            }
            profileId={profile?.id}
            preferSubtitles={profile?.preferSubtitles}
          />
        )}
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <section className="rounded-xl border bg-white p-5 md:p-7">
            <div className="flex flex-wrap gap-2 text-xs font-semibold text-muted-foreground">
              <span>{content.classification}</span>
              <span>{content.releaseYear}</span>
              {asset.episode ? (
                <span>Episode {asset.episode.episodeNumber}</span>
              ) : null}
            </div>
            <h1 className="mt-3 text-3xl font-black tracking-tight">{title}</h1>
            <p className="mt-4 max-w-4xl leading-7 text-slate-600">
              {asset.episode?.description ?? content.description}
            </p>
            <div className="mt-6 flex flex-wrap gap-5">
              {content.credits.slice(0, 5).map((credit) => (
                <div
                  key={`${credit.personId}-${credit.creditType}`}
                  className="flex items-center gap-2"
                >
                  <PersonAvatar
                    name={credit.person.name}
                    src={credit.person.imageUrl}
                    className="h-10 w-10"
                  />
                  <div>
                    <p className="text-sm font-bold">{credit.person.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {credit.characterName ?? credit.creditType.toLowerCase()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <aside className="rounded-xl border bg-white p-5">
            <p className="text-xs font-bold tracking-wider text-primary uppercase">
              Your viewing profile
            </p>
            <h2 className="mt-3 text-xl font-bold">
              {profile?.name ?? "Viewer"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your history and resume position are saved to this profile.
            </p>
            <Link
              href={`/profiles?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="mt-4 inline-block text-sm font-bold text-primary"
            >
              Switch profile →
            </Link>
            <Link
              href={`/title/${content.slug}`}
              className="mt-4 block text-sm font-bold text-primary"
            >
              {asset.episode
                ? "View all seasons and episodes"
                : "View title details"}{" "}
              →
            </Link>
          </aside>
        </div>
      </div>
    </main>
  )
}
function PlayerState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode
  title: string
  body: string
}) {
  return (
    <div className="grid aspect-video max-h-[720px] place-items-center rounded-xl bg-[#0d1726] p-8 text-center text-white shadow-2xl">
      <div>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-white/10 text-amber-400 [&>svg]:h-7 [&>svg]:w-7">
          {icon}
        </span>
        <h1 className="mt-5 text-2xl font-extrabold">{title}</h1>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/60">
          {body}
        </p>
      </div>
    </div>
  )
}
