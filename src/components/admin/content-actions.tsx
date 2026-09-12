"use client";

import { Eye, EyeOff, Trash2 } from "lucide-react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { api } from "@/lib/api-client";

export function ContentActions({ id, slug, status, title }: { id: string; slug: string; status: string; title: string }) {
  const router = useRouter();
  const publication = useMutation({ mutationFn: () => api(`/admin/content/${id}/publication`, { method: "PATCH", body: JSON.stringify({ status: status === "PUBLISHED" ? "UNPUBLISHED" : "PUBLISHED" }) }), onSuccess: () => { toast.success(status === "PUBLISHED" ? "Content unpublished." : "Content published."); router.refresh(); }, onError: (error) => toast.error(error.message) });
  const remove = useMutation({ mutationFn: () => api(`/admin/content/${id}`, { method: "DELETE" }), onSuccess: () => { toast.success("Content deleted."); router.refresh(); }, onError: (error) => toast.error(error.message) });
  return <div className="flex items-center justify-end gap-1"><Link href={`/title/${slug}`} aria-label={`View ${title}`} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted"><Eye className="h-4 w-4" /></Link><button disabled={publication.isPending} onClick={() => publication.mutate()} aria-label={status === "PUBLISHED" ? `Unpublish ${title}` : `Publish ${title}`} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted">{status === "PUBLISHED" ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}</button><button disabled={remove.isPending} onClick={() => { if (confirm(`Permanently delete “${title}”?`)) remove.mutate(); }} aria-label={`Delete ${title}`} className="grid h-8 w-8 place-items-center rounded-md text-destructive hover:bg-red-50"><Trash2 className="h-4 w-4" /></button></div>;
}
