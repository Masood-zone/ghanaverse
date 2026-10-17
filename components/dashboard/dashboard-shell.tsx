"use client"
import { useState, type ReactNode } from "react"
import Link from "@/components/common/app-link"
import { usePathname } from "next/navigation"
import { Brand } from "@/components/layout/brand"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
const navigation = [
  ["Dashboard", "/admin", "dashboard"],
  ["Content", "/admin/content", "video_library"],
  ["Video storage", "/admin/storage", "cloud_upload"],
  ["Creators", "/admin/creators", "groups"],
  ["Metadata & Rights", "/admin/metadata", "category"],
  ["Collections", "/admin/collections", "collections_bookmark"],
  ["Users", "/admin/users", "group"],
  ["Premium Users", "/admin/premium-users", "workspace_premium"],
  ["Activity", "/admin/activity", "history"],
  ["Analytics", "/admin/analytics", "analytics"],
  ["Licensing & Payouts", "/admin/royalties", "payments"],
  ["Notifications", "/admin/notifications", "notifications"],
] as const
export function DashboardShell({
  children,
  name,
}: {
  children: ReactNode
  name: string
}) {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  return (
    <div className="gv-admin min-h-screen md:pl-[260px]">
      <aside
        className={`${open ? "flex" : "hidden"} fixed inset-y-0 left-0 z-50 w-[260px] flex-col border-r bg-white px-4 py-6 shadow-sm md:flex`}
      >
        <div className="mb-6 flex shrink-0 items-center justify-between px-2">
          <Brand admin />
          <button
            aria-label="Close navigation"
            className="md:hidden"
            onClick={() => setOpen(false)}
          >
            <MaterialSymbol icon="close" />
          </button>
        </div>
        <nav
          aria-label="Administration"
          className="grid min-h-0 flex-1 content-start gap-1 overflow-y-auto overscroll-contain pr-1"
        >
          {navigation.map(([label, href, icon]) => (
            <Link
              key={href}
              href={href}
              onClick={() => setOpen(false)}
              aria-current={
                (href === "/admin" ? path === href : path.startsWith(href))
                  ? "page"
                  : undefined
              }
              className={`flex items-center gap-3 rounded-md px-3 py-3 text-[13px] font-semibold ${(href === "/admin" ? path === href : path.startsWith(href)) ? "bg-[#e6eeff] text-[#6b3700]" : "text-slate-700 hover:bg-slate-50"}`}
            >
              <MaterialSymbol icon={icon} className="text-[19px]" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 shrink-0 border-t pt-4">
          <Link
            href="/"
            className="flex items-center justify-between px-3 py-3 text-sm"
          >
            View GhanaVerse
            <MaterialSymbol icon="open_in_new" className="text-base" />
          </Link>
          <SignOutButton />
        </div>
      </aside>
      {open ? (
        <button
          aria-label="Close navigation overlay"
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setOpen(false)}
        />
      ) : null}
      <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between border-b bg-white/95 px-4 backdrop-blur md:px-7">
        <div className="flex items-center gap-3">
          <button
            aria-label="Open navigation"
            className="md:hidden"
            onClick={() => setOpen(true)}
          >
            <MaterialSymbol icon="menu" />
          </button>
          <span className="hidden text-xs sm:inline">
            GhanaVerse Administration
          </span>
          <span className="rounded bg-green-100 px-2 py-1 text-[9px] font-bold text-green-800">
            Catalogue workspace
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs font-semibold">{name}</p>
            <span className="text-[9px] font-bold text-primary">ADMIN</span>
          </div>
          <span className="grid size-8 place-items-center rounded-full bg-[#6b3700] text-white">
            <MaterialSymbol icon="person" className="text-lg" />
          </span>
        </div>
      </header>
      <main className="p-4 md:p-7">{children}</main>
    </div>
  )
}
