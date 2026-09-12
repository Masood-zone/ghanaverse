"use client";

import Image from "next/image";
import { useState } from "react";
import { safeArtworkUrl } from "@/lib/image-policy";
import { cn } from "@/lib/utils";

type ArtworkProps = { src?: string | null; alt: string; variant?: "poster" | "backdrop" | "landscape"; className?: string; priority?: boolean };
export function ContentArtwork({ src, alt, variant = "poster", className, priority = false }: ArtworkProps) {
  const fallback = variant === "poster" ? "/images/fallback-poster.svg" : "/images/fallback-backdrop.svg";
  const candidate = safeArtworkUrl(src) ?? fallback; const [failedSrc, setFailedSrc] = useState<string>(); const imageSrc = failedSrc === candidate ? fallback : candidate;
  return <Image src={imageSrc} alt={alt} fill priority={priority} sizes={variant === "poster" ? "(max-width: 640px) 48vw, (max-width: 1024px) 30vw, 220px" : "(max-width: 768px) 100vw, 50vw"} className={cn("object-cover", className)} onError={() => setFailedSrc(candidate)} />;
}

export function PersonAvatar({ name, src, className }: { name: string; src?: string | null; className?: string }) {
  const candidate = safeArtworkUrl(src); const [failedSrc, setFailedSrc] = useState<string>(); const imageSrc = failedSrc === candidate ? undefined : candidate;
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "GV";
  return <div className={cn("relative grid shrink-0 place-items-center overflow-hidden rounded-full bg-amber-100 font-bold text-amber-900", className ?? "h-12 w-12 text-sm")}>{imageSrc ? <Image src={imageSrc} alt={name} fill sizes="96px" className="object-cover" onError={() => setFailedSrc(candidate)} /> : initials}</div>;
}
