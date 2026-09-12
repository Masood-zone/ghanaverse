import { MetadataManager } from "@/components/admin/metadata-manager";
import { getPrisma } from "@/lib/prisma";

export default async function MetadataPage() {
  const db = getPrisma(); const [genres, languages, classifications, companies, rights] = await Promise.all([
    db.genre.findMany({ include: { _count: { select: { contents: true } } }, orderBy: { name: "asc" } }),
    db.language.findMany({ include: { _count: { select: { contents: true } } }, orderBy: { name: "asc" } }),
    db.classification.findMany({ include: { _count: { select: { contents: true } } }, orderBy: { name: "asc" } }),
    db.productionCompany.findMany({ include: { _count: { select: { contents: true } } }, orderBy: { name: "asc" } }),
    db.rightsHolder.findMany({ include: { _count: { select: { contents: true } } }, orderBy: { name: "asc" } }),
  ]);
  return <section><p className="text-xs font-bold uppercase tracking-[.16em] text-primary">Taxonomy &amp; Legal Registry</p><h1 className="mt-2 max-w-3xl text-4xl font-black tracking-tight md:text-5xl">Metadata &amp; Rights Management</h1><p className="mt-3 max-w-3xl text-slate-600">Manage platform genres, languages, classifications, production companies, and administrative rights-holder records.</p><div className="mt-8"><MetadataManager data={{ genres: genres.map((item) => ({ ...item, count: item._count.contents })), languages: languages.map((item) => ({ ...item, count: item._count.contents })), classifications: classifications.map((item) => ({ ...item, count: item._count.contents })), "production-companies": companies.map((item) => ({ ...item, count: item._count.contents })), "rights-holders": rights.map((item) => ({ ...item, count: item._count.contents })) }} /></div></section>;
}
