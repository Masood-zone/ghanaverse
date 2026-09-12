import { Play } from "lucide-react";
import Link from "next/link";
import { ContentArtwork } from "@/components/catalogue/content-artwork";

export function LandscapeCard({ title, subtitle, href, image, progress }: { title: string; subtitle?: string; href: string; image?: string | null; progress?: number }) {
  return <Link href={href} className="group block min-w-0 snap-start"><article className="overflow-hidden rounded-lg border bg-white"><div className="relative aspect-video overflow-hidden bg-muted"><ContentArtwork src={image} alt="" variant="landscape" /><div className="absolute inset-0 grid place-items-center bg-black/0 transition group-hover:bg-black/25"><span className="grid h-10 w-10 scale-90 place-items-center rounded-full bg-white/95 text-primary opacity-0 shadow transition group-hover:scale-100 group-hover:opacity-100"><Play className="ml-0.5 h-4 w-4 fill-current" /></span></div>{typeof progress === "number" ? <div className="absolute inset-x-0 bottom-0 h-1 bg-white/60"><div className="h-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div> : null}</div><div className="p-3"><h3 className="truncate text-sm font-bold">{title}</h3>{subtitle ? <p className="mt-1 truncate text-xs text-muted-foreground">{subtitle}</p> : null}</div></article></Link>;
}
