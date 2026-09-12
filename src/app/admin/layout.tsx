import Link from "next/link";
import type { ReactNode } from "react";
import { Brand } from "@/components/layout/brand";
import { requireAdminPage } from "@/lib/auth/access";
import { SignOutButton } from "@/components/auth/sign-out-button";
const links = [["Dashboard", "/admin"], ["Content", "/admin/content"], ["Metadata & Rights", "/admin/metadata"], ["Users & Subscriptions", "/admin/users"], ["Analytics", "/admin/analytics"], ["Royalties", "/admin/royalties"]] as const;
export default async function AdminLayout({ children }: { children: ReactNode }) { await requireAdminPage(); return <div className="min-h-screen bg-background md:grid md:grid-cols-[260px_1fr]"><aside className="flex border-b bg-card p-5 md:min-h-screen md:flex-col md:border-b-0 md:border-r"><div><Brand admin /><nav className="mt-8 grid gap-1">{links.map(([label, href]) => <Link key={href} href={href} className="rounded-md px-3 py-2.5 text-sm font-semibold text-muted-foreground hover:bg-muted hover:text-foreground">{label}</Link>)}</nav></div><div className="mt-10 border-t pt-4 md:mt-auto"><Link className="block rounded-md px-3 py-2 text-sm font-semibold text-muted-foreground hover:bg-muted" href="/">View GhanaVerse</Link><SignOutButton /></div></aside><main className="p-6 md:p-9">{children}</main></div>; }
