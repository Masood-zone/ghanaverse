import Link from "next/link";
import { ProfileManager } from "@/components/profiles/profile-manager";
import { requireUserPage } from "@/lib/auth/access";
import { getPrisma } from "@/lib/prisma";
import { getActiveProfile } from "@/lib/profiles";

export default async function ProfilesPage() {
  const { user } = await requireUserPage("/profiles");
  const [profiles, active] = await Promise.all([getPrisma().viewerProfile.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } }), getActiveProfile(user.id)]);
  return <main className="relative min-h-[calc(100vh-4rem)] overflow-hidden bg-[radial-gradient(circle_at_8%_15%,#fef3c7,transparent_26%),radial-gradient(circle_at_90%_88%,#dcfce7,transparent_28%),#faf9f6]"><div className="gv-container py-14 text-center md:py-24"><span className="inline-flex rounded-full bg-white px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-600 shadow-sm">Your GhanaVerse</span><h1 className="mt-6 text-4xl font-black tracking-tight md:text-6xl">Who&apos;s watching?</h1><p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">Choose a profile to access personalized Ghanaian stories, your library, and viewing history.</p><ProfileManager initialProfiles={profiles.map(({ id, name, avatar }) => ({ id, name, avatar }))} activeId={active?.id} /><div className="mx-auto mt-12 max-w-2xl border-t pt-6 text-right"><Link href="/account" className="text-sm font-semibold text-muted-foreground hover:text-primary">Account settings →</Link></div></div></main>;
}
