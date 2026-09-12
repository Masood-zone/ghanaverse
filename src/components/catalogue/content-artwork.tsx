"use client";

import Image from "next/image";
import { useState } from "react";
import { safeRemoteImageUrl } from "@/lib/image-policy";

type ArtworkProps = { src?: string | null; trailerVideoId?: string | null; alt: string; variant?: "poster" | "backdrop"; className?: string; priority?: boolean };
function trailerThumbnail(videoId?: string | null) { return videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : undefined; }
export function ContentArtwork({ src, trailerVideoId, alt, variant = "poster", className, priority = false }: ArtworkProps) { const fallback = variant === "poster" ? "/images/fallback-poster.svg" : "/images/fallback-backdrop.svg"; const candidate = safeRemoteImageUrl(src) ?? trailerThumbnail(trailerVideoId) ?? fallback; const [imageSrc, setImageSrc] = useState(candidate); return <Image src={imageSrc} alt={alt} fill priority={priority} sizes={variant === "poster" ? "(max-width: 640px) 48vw, (max-width: 1024px) 25vw, 220px" : "100vw"} className={className ?? "object-cover"} onError={() => setImageSrc(fallback)} />; }
export function PersonAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) { const [imageSrc, setImageSrc] = useState(safeRemoteImageUrl(src)); const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "GV"; return <div className={`relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-bold text-primary ${className ?? "h-12 w-12 text-sm"}`}>{imageSrc ? <Image src={imageSrc} alt={name} fill sizes="96px" className="object-cover" onError={() => setImageSrc(undefined)} /> : initials}</div>; }
