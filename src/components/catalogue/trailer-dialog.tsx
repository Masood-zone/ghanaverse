"use client";

import { Play, X } from "lucide-react";
import { useState } from "react";

export function TrailerDialog({ videoId, title }: { videoId: string; title: string }) {
  const [open, setOpen] = useState(false);
  return <><button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-white/45 bg-black/30 px-5 py-3 text-sm font-bold text-white backdrop-blur hover:bg-black/50"><Play className="h-4 w-4" />Watch Trailer</button>{open ? <div role="dialog" aria-modal="true" aria-label={`${title} trailer`} className="fixed inset-0 z-[70] grid place-items-center bg-black/70 p-4 backdrop-blur-sm" onMouseDown={(event) => { if (event.currentTarget === event.target) setOpen(false); }}><div className="w-full max-w-5xl overflow-hidden rounded-xl bg-black shadow-2xl"><div className="flex items-center justify-between px-4 py-3 text-white"><h2 className="font-bold">{title} — Trailer</h2><button onClick={() => setOpen(false)} aria-label="Close trailer" className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10"><X className="h-5 w-5" /></button></div><div className="aspect-video"><iframe src={`https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&rel=0`} title={`${title} trailer`} allow="autoplay; encrypted-media; picture-in-picture" allowFullScreen className="h-full w-full" /></div></div></div> : null}</>;
}
