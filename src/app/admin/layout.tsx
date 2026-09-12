import { ExternalLink, Menu } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { Brand } from "@/components/layout/brand";
import { requireAdminPage } from "@/lib/auth/access";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdminPage();
  return <div className="min-h-screen bg-[#f3f6fd] md:grid md:grid-cols-[260px_1fr]"><aside className="sticky top-0 hidden h-screen flex-col border-r bg-white p-5 md:flex"><Brand admin /><div className="mt-8"><AdminNavigation /></div><div className="mt-auto border-t pt-4"><AdminUtilities /></div></aside><div><div className="sticky top-0 z-40 flex items-center justify-between border-b bg-white px-4 py-3 md:hidden"><Brand admin /><details className="relative"><summary aria-label="Open admin navigation" className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border"><Menu className="h-5 w-5" /></summary><div className="absolute right-0 top-12 z-50 w-64 rounded-xl border bg-white p-3 shadow-xl"><AdminNavigation /><div className="mt-3 border-t pt-3"><AdminUtilities /></div></div></details></div><header className="border-b bg-white"><div className="flex min-h-16 items-center justify-between gap-4 px-5 py-3 md:px-8"><div><p className="text-xs font-semibold text-muted-foreground">GhanaVerse Administration</p><span className="mt-1 inline-flex rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-800">Live Catalogue</span></div><div className="text-right"><p className="text-sm font-bold">{user.name}</p><p className="text-[10px] font-bold uppercase tracking-wider text-primary">Admin</p></div></div></header><main className="p-5 md:p-8">{children}</main></div></div>;
}

function AdminUtilities() {
  return <><Link className="flex items-center justify-between rounded-md px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-muted" href="/">View GhanaVerse<ExternalLink className="h-4 w-4" /></Link><SignOutButton /></>;
}
