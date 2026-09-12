import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentEditor, type EditorContent } from "@/components/admin/content-editor";
import { ContentType, MediaRights, PublicationStatus } from "@/generated/prisma/enums";
import { getPrisma } from "@/lib/prisma";

export default async function AdminContentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params; const isNew = id === "new"; const db = getPrisma();
  const [record, genres, languages, classifications, companies, rightsHolders, people] = await Promise.all([
    isNew ? null : db.content.findUnique({ where: { id }, include: { genres: true, languages: true, credits: true, trailer: true, seasons: { orderBy: { seasonNumber: "asc" }, include: { episodes: { orderBy: { episodeNumber: "asc" } } } }, videoAssets: true } }),
    db.genre.findMany({ orderBy: { name: "asc" } }), db.language.findMany({ orderBy: { name: "asc" } }), db.classification.findMany({ orderBy: { name: "asc" } }), db.productionCompany.findMany({ orderBy: { name: "asc" } }), db.rightsHolder.findMany({ orderBy: { name: "asc" } }), db.person.findMany({ orderBy: { name: "asc" }, take: 80 }),
  ]); if (!isNew && !record) notFound();
  const content: EditorContent = record ? { ...record, releaseDate: record.releaseDate?.toISOString() ?? null, seasons: record.seasons.map((season) => ({ ...season, episodes: season.episodes.map((episode) => ({ ...episode, airDate: episode.airDate?.toISOString() ?? null })) })) } : { title: "", slug: "", shortDescription: "", description: "", tagline: null, releaseYear: new Date().getFullYear(), releaseDate: null, country: "Ghana", seriesStatus: null, contentType: ContentType.MOVIE, runtimeMinutes: null, classification: null, publicationStatus: PublicationStatus.DRAFT, isFeatured: false, isPremium: false, posterUrl: null, backdropUrl: null, mediaRights: MediaRights.UNKNOWN, attributionNotes: null, productionCompanyId: null, rightsHolderId: null, metadataSource: "MANUAL", externalId: null, sourceReferenceUrl: null, genres: [], languages: [], credits: [], trailer: null, seasons: [], videoAssets: [] };
  return <section><Link href="/admin/content" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-primary"><ArrowLeft className="h-4 w-4" />Back to Content Library</Link><div className="mt-4 flex flex-wrap items-center gap-3"><h1 className="text-3xl font-black tracking-tight text-[#6b2500]">{isNew ? "Add Content" : `Editing: ${record?.title}`}</h1>{record ? <span className={`rounded-full px-3 py-1 text-xs font-bold ${record.publicationStatus === "PUBLISHED" ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}`}>{record.publicationStatus}</span> : null}</div><ContentEditor content={content} options={{ genres, languages, classifications, companies, rightsHolders, people }} /></section>;
}
