import Link from "next/link"
import { notFound } from "next/navigation"
import { requireAdminPage } from "@/lib/auth/access"
import { callbackWithSearch, type PageSearchParams } from "@/lib/auth/callback"
import { getPrisma } from "@/lib/prisma"
import { ContentArtwork } from "@/components/catalogue/content-artwork"
import { AssetPreview } from "@/components/uploads/asset-preview"
export default async function Preview({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<PageSearchParams>
}) {
  const [{ id }, query] = await Promise.all([params, searchParams])
  await requireAdminPage(
    callbackWithSearch(`/admin/content/${id}/preview`, query)
  )
  const content = await getPrisma().content.findUnique({
    where: { id },
    include: {
      videoAssets: true,
      genres: { include: { genre: true } },
      languages: { include: { language: true } },
      credits: { include: { person: true } },
      productionCompany: true,
      seasons: {
        orderBy: { seasonNumber: "asc" },
        include: { episodes: { orderBy: { episodeNumber: "asc" }, include: { videoAssets: true } } },
      },
    },
  })
  if (!content) notFound()
  return (
    <>
      <div className="mb-5 flex justify-between">
        <Link className="gv-action secondary" href={`/admin/content/${id}`}>
          ← Return to editor
        </Link>
        <span className="rounded bg-amber-100 p-3 text-xs font-bold text-amber-900">
          Private administrator preview
        </span>
      </div>
      <section className="relative isolate overflow-hidden rounded-xl bg-slate-900 text-white">
        <div className="absolute inset-0">
          <ContentArtwork src={content.backdropUrl} alt="" variant="backdrop" />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 to-black/30" />
        <div className="relative grid gap-7 p-7 md:grid-cols-[180px_1fr] md:p-12">
          <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
            <ContentArtwork src={content.posterUrl} alt={content.title} />
          </div>
          <div className="self-center">
            <p className="text-xs font-bold text-amber-300">
              {content.contentType.replaceAll("_", " ")} ·{" "}
              {content.classification ?? "Unclassified"}
            </p>
            <h1 className="mt-4 text-4xl font-extrabold">{content.title}</h1>
            <p className="mt-5 max-w-2xl leading-7">
              {content.shortDescription}
            </p>
            <p className="mt-4 text-xs text-white/70">
              {content.genres.map((g) => g.genre.name).join(" · ")} ·{" "}
              {content.languages.map((l) => l.language.name).join(" / ")}
            </p>
          </div>
        </div>
      </section>
      <div className="gv-panel mt-6">
        <div className="mb-5 flex flex-wrap gap-4">{content.videoAssets.map((asset) => <AssetPreview key={asset.id} id={asset.id} label={`Preview ${asset.sourceType}`} />)}</div>
        <h2 className="text-xl font-bold">Story</h2>
        <p className="mt-4 leading-7 whitespace-pre-wrap">
          {content.description}
        </p>
        <h2 className="mt-7 text-xl font-bold">Creative Leadership</h2>
        <div className="mt-4 flex flex-wrap gap-3">
          {content.credits.map((credit) => (
            <div
              key={credit.personId + credit.creditType}
              className="rounded-lg bg-white p-4"
            >
              <p className="font-bold">{credit.person.name}</p>
              <p className="mt-1 text-xs">
                {credit.creditType}
                {credit.characterName ? ` · ${credit.characterName}` : ""}
              </p>
            </div>
          ))}
        </div>
        {content.productionCompany ? (
          <p className="mt-4 text-sm">
            Production: {content.productionCompany.name}
          </p>
        ) : null}
        {content.seasons.map((season) => (
          <div className="mt-6" key={season.id}>
            <h3 className="font-bold">Season {season.seasonNumber}</h3>
            {season.episodes.map((episode) => (
              <p className="mt-2 rounded bg-white p-3 text-sm" key={episode.id}>
                {episode.episodeNumber}. {episode.title}
                <span className="ml-4 inline-flex gap-3">{episode.videoAssets.map((asset) => <AssetPreview key={asset.id} id={asset.id} label={`Preview ${asset.sourceType}`} />)}</span>
              </p>
            ))}
          </div>
        ))}
      </div>
    </>
  )
}
