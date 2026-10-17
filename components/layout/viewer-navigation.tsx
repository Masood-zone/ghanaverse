"use client"
import { Input } from "@/components/ui/input"

import { Menu, Search } from "@/components/common/icons"
import Link from "@/components/common/app-link"
import { usePathname } from "next/navigation"
import { useSignOut } from "@/components/auth/use-sign-out"
import { authClient } from "@/lib/auth-client"
import { cn } from "@/lib/utils"
import { PersonAvatar } from "@/components/catalogue/content-artwork"
import { useAccount } from "@/services/viewer/account"
import { useSyncExternalStore } from "react"
import { PremiumBadge } from "@/components/billing/premium-badge"

const subscribeHydration = () => () => {}
const clientHydrated = () => true
const serverHydrated = () => false

const publicLinks = [
  ["Home", "/"],
  ["Browse / Catalogue", "/browse"],
  ["Pricing", "/plans"],
  ["Search", "/search"],
] as const
const memberLinks = [
  ["My Library", "/library"],
  ["Profiles", "/profiles"],
] as const

export function ViewerNavigation() {
  const hydrated = useSyncExternalStore(
    subscribeHydration,
    clientHydrated,
    serverHydrated
  )
  const { data: currentSession } = authClient.useSession()
  // Better Auth's browser cache can already be populated while SSR has no session.
  const session = hydrated ? currentSession : null
  const pathname = usePathname()
  const { signOut, pending: signingOut } = useSignOut()
  const links = session ? [...publicLinks, ...memberLinks] : publicLinks
  const user = session?.user
  const account = useAccount(Boolean(session))
  const premium = Boolean(session && account.data?.premium?.active)
  const linkClass = (href: string) =>
    cn(
      "rounded-md px-3 py-2 text-sm font-medium transition",
      pathname === href
        ? "bg-amber-100 text-amber-900"
        : "text-slate-600 hover:bg-muted hover:text-foreground"
    )
  const activeProfile = session
    ? account.data?.profiles.find(
        (profile) => profile.id === account.data.activeId
      )
    : undefined
  const accountMenu = (
    <>
      {account.data?.hasRightsHolderReports ? (
        <Link
          href="/creator/earnings"
          className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Licensing &amp; earnings
        </Link>
      ) : null}
      {account.data?.hasRightsHolderReports ? (
        <Link
          href="/creator/content"
          className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Manage your content
        </Link>
      ) : null}
      {account.data?.hasRightsHolderReports ? (
        <Link
          href="/creator/analytics"
          className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
        >
          Rights-holder reports
        </Link>
      ) : null}
      {account.data?.role ? (
        <span className="px-3 py-1 text-xs font-semibold text-primary">
          {account.data.role.replaceAll("_", " ")}
        </span>
      ) : null}
      {activeProfile ? (
        <p className="px-3 py-2 text-xs text-muted-foreground">
          Watching as <strong>{activeProfile.name}</strong>
          {activeProfile.isKids ? " · Kids" : ""}
        </p>
      ) : null}
      <Link
        href="/profiles"
        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        Switch Profile
      </Link>
      <Link
        href="/account"
        className="rounded-md px-3 py-2 text-sm font-medium hover:bg-muted"
      >
        Account
      </Link>
      <button
        className="rounded-md px-3 py-2 text-left text-sm font-medium text-destructive hover:bg-red-50"
        onClick={signOut}
        disabled={signingOut}
      >
        {signingOut ? "Signing out…" : "Sign Out"}
      </button>
    </>
  )
  return (
    <>
      <nav className="hidden items-center gap-1 lg:flex" aria-label="Primary">
        {links.map(([label, href]) => (
          <Link key={href} href={href} className={linkClass(href)}>
            {label}
          </Link>
        ))}
      </nav>
      <div className="ml-auto hidden items-center gap-3 md:flex">
        <form action="/search" className="relative hidden xl:block">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            name="q"
            aria-label="Search titles"
            placeholder="Search titles…"
            className="h-9 w-52 rounded-md border bg-muted/70 pr-3 pl-9 text-sm focus:bg-white"
          />
        </form>
        {session ? (
          <div className="flex items-center gap-3">
            {user ? (
              <UserIdentity
                premium={premium}
                user={{
                  name: account.data?.name ?? user.name,
                  email: user.email,
                }}
                compact
                profileName={
                  activeProfile
                    ? `${activeProfile.name}${activeProfile.isKids ? " · Kids" : ""}`
                    : undefined
                }
              />
            ) : null}
            {premium ? <PremiumBadge className="xl:hidden" /> : null}
            <details className="relative">
              <summary
                aria-label="Account menu"
                className="grid h-9 w-9 cursor-pointer list-none place-items-center rounded-full bg-amber-800 text-white"
              >
                <PersonAvatar
                  name={activeProfile?.name ?? user?.name ?? "Account"}
                  src={
                    activeProfile ? activeProfile.image : account.data?.image
                  }
                  className="h-9 w-9 text-xs"
                />
              </summary>
              <div className="absolute top-12 right-0 z-50 grid w-56 gap-1 rounded-lg border bg-card p-2 shadow-xl">
                {user ? (
                  <UserIdentity
                    premium={premium}
                    user={{
                      name: account.data?.name ?? user.name,
                      email: user.email,
                    }}
                  />
                ) : null}
                {accountMenu}
              </div>
            </details>
          </div>
        ) : (
          <>
            <Link className="text-sm font-semibold text-slate-700" href="/auth">
              Sign In
            </Link>
            <Link
              className="rounded-md bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-primary-hover"
              href="/auth?mode=register"
            >
              Get Started
            </Link>
          </>
        )}
      </div>
      {activeProfile || premium ? (
        <div className="ml-auto max-w-28 min-w-0 md:hidden">
          {activeProfile ? (
            <p className="truncate text-xs font-semibold text-primary">
              {activeProfile.name}
              {activeProfile.isKids ? " · Kids" : ""}
            </p>
          ) : null}
          {premium ? <PremiumBadge className="mt-1" /> : null}
        </div>
      ) : null}
      <details className="relative ml-auto lg:hidden">
        <summary
          aria-label="Open navigation"
          className="grid h-10 w-10 cursor-pointer list-none place-items-center rounded-md border"
        >
          <Menu className="h-5 w-5" />
        </summary>
        <div className="absolute top-12 right-0 z-50 grid w-64 gap-1 rounded-lg border bg-card p-2 shadow-xl">
          {user ? (
            <UserIdentity
              premium={premium}
              user={{
                name: account.data?.name ?? user.name,
                email: user.email,
              }}
            />
          ) : null}
          {links.map(([label, href]) => (
            <Link key={href} href={href} className={linkClass(href)}>
              {label}
            </Link>
          ))}
          {session ? (
            accountMenu
          ) : (
            <>
              <Link
                href="/auth"
                className="rounded-md px-3 py-2 text-sm font-medium"
              >
                Sign In
              </Link>
              <Link
                href="/auth?mode=register"
                className="rounded-md bg-primary px-3 py-2 text-sm font-bold text-white"
              >
                Get Started
              </Link>
            </>
          )}
        </div>
      </details>
    </>
  )
}

function UserIdentity({
  user,
  compact = false,
  profileName,
  premium,
}: {
  user: { name: string; email: string }
  compact?: boolean
  profileName?: string
  premium: boolean
}) {
  return (
    <div
      className={cn(
        "min-w-0",
        compact ? "hidden w-52 text-right xl:block" : "mb-1 border-b px-3 py-2"
      )}
    >
      <div
        className={cn(
          "flex min-w-0 items-center gap-2",
          compact && "justify-end"
        )}
      >
        <p className="truncate text-sm font-bold text-foreground">
          {user.name}
        </p>
        {premium ? <PremiumBadge /> : null}
      </div>
      <p className="truncate text-xs text-muted-foreground">{user.email}</p>
      {profileName ? (
        <p className="truncate text-[10px] font-semibold text-primary">
          Watching: {profileName}
        </p>
      ) : null}
    </div>
  )
}
