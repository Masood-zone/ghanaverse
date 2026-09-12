"use client";

import { Database, LayoutDashboard, LibraryBig } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const links = [["Dashboard", "/admin", LayoutDashboard], ["Content", "/admin/content", LibraryBig], ["Metadata & Rights", "/admin/metadata", Database]] as const;
export function AdminNavigation() { const pathname = usePathname(); return <nav className="grid gap-1">{links.map(([label, href, Icon]) => { const active = href === "/admin" ? pathname === href : pathname.startsWith(href); return <Link key={href} href={href} className={cn("flex items-center gap-3 rounded-md px-3 py-3 text-sm font-semibold", active ? "bg-[#dce6fb] text-[#6b2500]" : "text-slate-700 hover:bg-muted")}><Icon className="h-4 w-4" />{label}</Link>; })}</nav>; }
