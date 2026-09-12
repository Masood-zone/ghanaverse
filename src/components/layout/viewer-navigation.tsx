"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

const publicLinks = [["Home", "/"], ["Browse", "/browse"], ["Search", "/search"]] as const;
const memberLinks = [["My Library", "/library"], ["Profile", "/profiles"]] as const;
const profileLinks = [["Switch Profile", "/profiles"], ["Account", "/account"], ["Subscription", "/plans"]] as const;

export function ViewerNavigation() {
  const { data: session } = authClient.useSession();
  const router = useRouter();
  const links = session ? [...publicLinks, ...memberLinks] : [...publicLinks, ["Pricing", "/plans"] as const];
  async function signOut() { await authClient.signOut(); router.push("/"); router.refresh(); }
  const profileMenu = <>{profileLinks.map(([label, href]) => <Link key={href} href={href} className="block rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">{label}</Link>)}<button className="w-full rounded-md px-3 py-2 text-left text-sm font-semibold text-destructive hover:bg-red-50" onClick={signOut}>Sign Out</button></>;

  return <>
    <nav className="hidden items-center gap-1 md:flex">{links.map(([label, href]) => <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">{label}</Link>)}</nav>
    <div className="ml-auto hidden items-center gap-3 sm:flex">{session ? <details className="relative"><summary className="cursor-pointer list-none rounded-md border px-4 py-2 text-sm font-semibold hover:bg-muted">Profile</summary><div className="absolute right-0 top-12 z-30 w-56 rounded-lg border bg-card p-2 shadow-lg">{profileMenu}</div></details> : <><Link className="text-sm font-semibold text-muted-foreground hover:text-foreground" href="/auth">Sign In</Link><Link className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary-hover" href="/auth?mode=register">Get Started</Link></>}</div>
    <details className="relative ml-auto md:hidden"><summary className="cursor-pointer list-none rounded-md border px-3 py-2 text-sm font-semibold">Menu</summary><div className="absolute right-0 top-12 z-30 grid w-56 gap-1 rounded-lg border bg-card p-2 shadow-lg">{links.map(([label, href]) => <Link key={href} href={href} className="rounded-md px-3 py-2 text-sm font-semibold hover:bg-muted">{label}</Link>)}{session ? profileMenu : <Link href="/auth" className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground">Sign In</Link>}</div></details>
  </>;
}
