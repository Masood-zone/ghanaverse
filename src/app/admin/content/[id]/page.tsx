import { notFound } from "next/navigation";
import { ContentEditor } from "@/components/admin/content-editor";
import { getPrisma } from "@/lib/prisma";

export default async function AdminContentEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const content = await getPrisma().content.findUnique({ where: { id: (await params).id }, include: { trailer: true } }); if (!content) notFound();
  return <section><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">A03 · Content editor</p><h1 className="mt-3 text-4xl font-extrabold">Edit {content.title}</h1>{content.metadataSource === "GH_MOVIES_DB" ? <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm"><p className="font-bold">Imported metadata · GHMoviesDB</p><p className="mt-1 text-muted-foreground">External ID: {content.externalId ?? "not supplied"}. Provenance remains preserved while GhanaVerse manages local presentation.</p></div> : null}<ContentEditor content={content} /></section>;
}
