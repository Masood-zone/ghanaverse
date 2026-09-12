"use client";

import { Bookmark, Check } from "lucide-react";
import Link from "next/link";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export function WatchlistButton({ contentId, slug, authenticated, initialSaved = false }: { contentId: string; slug: string; authenticated: boolean; initialSaved?: boolean }) {
  const queryClient = useQueryClient();
  const mutation = useMutation({ mutationFn: (saved: boolean) => api<{ contentId?: string }>("/watchlist", { method: saved ? "DELETE" : "PUT", body: JSON.stringify({ contentId }) }), onSuccess: (_, saved) => { toast.success(saved ? "Removed from My List." : "Added to My List."); void queryClient.invalidateQueries({ queryKey: ["library"] }); } });
  if (!authenticated) return <Link href={`/auth?callbackUrl=${encodeURIComponent(`/title/${slug}`)}`} className="inline-flex items-center gap-2 rounded-md border border-white/45 bg-white/10 px-5 py-3 text-sm font-bold text-white"><Bookmark className="h-4 w-4" />Add to My List</Link>;
  const saved = mutation.isSuccess ? !mutation.variables : initialSaved;
  return <button disabled={mutation.isPending} onClick={() => mutation.mutate(saved)} className="inline-flex items-center gap-2 rounded-md border border-white/45 bg-white/10 px-5 py-3 text-sm font-bold text-white disabled:opacity-60">{saved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}{saved ? "In My List" : "Add to My List"}</button>;
}
