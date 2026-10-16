import Link from "next/link"
import { requireUserPage } from "@/lib/auth/access"
import { contentAccess } from "@/services/content/access"
import { getPrisma } from "@/lib/prisma"
import { editorInclude } from "@/services/admin/read-models"
import { ContentArtwork } from "@/components/catalogue/content-artwork"
import { AssetPreview } from "@/components/uploads/asset-preview"
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params,
    db = getPrisma()
  const { user } = await requireUserPage(`/creator/content/${id}/preview`)
  await contentAccess(db, user.id, id)
  const content = await db.content.findUniqueOrThrow({
    where: { id },
    include: editorInclude,
  })
  return (
    <>
      <Link href={`/creator/content/${id}`} className="gv-action secondary">
        Return to editor
      </Link>
      <p className="my-4 text-xs font-bold text-primary">
        Private owner preview · {content.publicationStatus}
      </p>
      <section className="gv-panel grid gap-7 md:grid-cols-[180px_1fr]">
        <div className="relative aspect-[2/3] overflow-hidden rounded-lg">
          <ContentArtwork src={content.posterUrl} alt={content.title} />
        </div>
        <div>
          <h1 className="text-4xl font-extrabold">{content.title}</h1>
          <p className="mt-4 font-semibold">{content.shortDescription}</p>
          <p className="mt-5 whitespace-pre-wrap">{content.description}</p>
          <div className="mt-5 flex gap-4">
            {content.videoAssets.map((a) => (
              <AssetPreview
                key={a.id}
                id={a.id}
                label={`Preview ${a.sourceType}`}
              />
            ))}
          </div>
        </div>
      </section>
      {content.seasons.map((s) => (
        <section className="gv-panel mt-5" key={s.id}>
          <h2 className="text-xl font-bold">Season {s.seasonNumber}</h2>
          {s.episodes.map((e) => (
            <div
              className="mt-3 flex flex-wrap justify-between gap-3 rounded-lg bg-white p-4"
              key={e.id}
            >
              <p>
                Episode {e.episodeNumber}: {e.title}
              </p>
              {e.videoAssets.map((a) => (
                <AssetPreview
                  key={a.id}
                  id={a.id}
                  label={`Preview ${a.sourceType}`}
                />
              ))}
            </div>
          ))}
        </section>
      ))}
    </>
  )
}
