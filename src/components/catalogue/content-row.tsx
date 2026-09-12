import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { ContentCard, type CatalogueCardItem } from "@/components/catalogue/content-card";

export function ContentRow({ title, eyebrow, items, href = "/browse" }: { title: string; eyebrow?: string; items: CatalogueCardItem[]; href?: string }) {
  if (!items.length) return null;
  return <section className="mt-14"><div className="mb-5 flex items-end justify-between gap-4"><div>{eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[.16em] text-primary">{eyebrow}</p> : null}<h2 className="mt-1 text-xl font-extrabold tracking-tight md:text-2xl">{title}</h2></div><Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-primary">Explore all <ArrowRight className="h-4 w-4" /></Link></div><div className="gv-scroll grid auto-cols-[44%] grid-flow-col gap-4 overflow-x-auto pb-4 sm:auto-cols-[29%] lg:auto-cols-[19%] xl:auto-cols-[16%]">{items.map((item) => <ContentCard key={item.id ?? item.slug} item={item} compact />)}</div></section>;
}
