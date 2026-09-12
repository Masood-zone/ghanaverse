"use client";

import { Menu, Search, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";

const publicLinks = [["Home", "/"], ["Browse / Catalogue", "/browse"], ["Search", "/search"]] as const;
const memberLinks = [["My Library", "/library"], ["Profiles", "/profiles"]] as const;

export function ViewerNavigation() {
  const { data: session } = authClient.useSession(); const pathname = usePathname(); const router = useRouter();
  const links = session ? [...publicLinks, ...memberLinks] : publicLinks;
  const linkClass = (href: string) => cn("rounded-md px-3 py-2 text-sm font-medium transition", pathname === href ? "bg-amber-100 text-amber-900" : "text-slate-600 hover:bg-muted hover:text-foreground");
  async function signOut() { await authClient.signOut(); router.push("/"); router.refresh(); }
  const accountMenu = <><Link href="/profiles" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">Switch Profile</Link><Link href="/account" className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">Account</Link><button className="rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-red-50" onClick={signOut}>Sign Out</button></>;
  return <>
    <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">{links.map(([label, href]) => <Link key={href} href={href} className={linkClass(href)}>{label}</Link>)}</nav>
    <div className="ml-auto hidden items-center gap-3 md:flex">
      <form action="/search" className="relative hidden xl:block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><input name="q" aria-label="Search titles" placeholder="Search titles…" className="h-9 w-52 rounded-md border bg-muted/70 pl-9 pr-3 text-sm focus:bg-white" /></form>
      {session ? <details className="relative"><summary aria-label="Account menu" className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full bg-amber-800 text-white"><UserRound className="h-4 w-4" /></summary><div className="absolute right-0 top-12 z-50 grid w-52 gap-1 rounded-lg border bg-card p-2 shadow-xl">{accountMenu}</div></details> : <><Link className="text-sm font-semibold text-slate-700" href="/auth">Sign In</Link><Link className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover" href="/auth?mode=register">Get Started</Link></>}
    </div>
    <details className="relative ml-auto lg:hidden"><summary aria-label="Open navigation" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border"><Menu className="h-5 w-5" /></summary><div className="absolute right-0 top-12 z-50 grid w-64 gap-1 rounded-lg border bg-card p-2 shadow-xl">{links.map(([label, href]) => <Link key={href} href={href} className={linkClass(href)}>{label}</Link>)}{session ? accountMenu : <><Link href="/auth" className="rounded-md px-3 py-2 text-sm font-medium">Sign In</Link><Link href="/auth?mode=register" className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-white">Get Started</Link></>}</div></details>
  </>;
}
