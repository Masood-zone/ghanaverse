import Link from "next/link";
import { Play } from "lucide-react";
import { requireUserPage } from "@/lib/auth/access";

export default async function WatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireUserPage(`/watch/${id}`);
  return <main className="min-h-screen bg-[#121212] px-4 py-6 text-white sm:px-6 md:px-10"><div className="mx-auto max-w-6xl"><Link className="inline-flex items-center gap-2 text-sm font-semibold text-white/75 hover:text-white" href="/">← Back to GhanaVerse</Link><div className="mt-8 overflow-hidden rounded-xl border border-white/10 bg-[#1c1c1c] shadow-2xl"><div className="grid aspect-video place-items-center bg-[radial-gradient(circle_at_center,#393122_0%,#1c1c1c_48%,#101010_100%)]"><div className="text-center"><span className="mx-auto grid h-14 w-14 place-items-center rounded-full border border-[#ffb77d]/50 bg-[#d97706]/20 text-[#ffb77d]"><Play className="ml-1 h-6 w-6" fill="currentColor" /></span><p className="mt-5 text-xs font-bold uppercase tracking-[.18em] text-[#ffb77d]">GhanaVerse player</p><h1 className="mt-3 text-2xl font-extrabold sm:text-3xl">Video Player Coming Soon</h1></div></div><div className="border-t border-white/10 p-5"><p className="text-xs font-bold uppercase tracking-[.16em] text-[#ffb77d]">Title placeholder</p><h2 className="mt-2 text-lg font-bold">Title details will appear here</h2><p className="mt-2 text-sm leading-6 text-white/65">This protected cinematic shell intentionally has no playback implementation.</p></div></div></div></main>;
}
