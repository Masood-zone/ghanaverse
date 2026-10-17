"use client"
import Link from "next/link"
import type { ReactNode } from "react"
import { Brand } from "./brand"
import { ViewerNavigation } from "./viewer-navigation"
import "@/components/billing/subscriptions.css"
export function SubscriptionShell({ children }: { children: ReactNode }) {
  return (
    <div className="gv-subscription-frame">
      <header className="border-b bg-white">
        <div className="gv-subscription-nav">
          <Brand />
          <ViewerNavigation />
        </div>
        <div className="gv-kente-line" />
      </header>
      <main>{children}</main>
      <footer className="gv-subscription-footer">
        <div className="gv-subscription-footer-grid">
          <div>
            <Brand />
            <p>
              Celebrating the pulse of Ghanaian cinema, cultural archives,
              highlife rhythms, and modern episodic storytelling.
            </p>
            <span className="gv-sub-badge green">
              ● Ghanaian cinema &amp; culture
            </span>
          </div>
          <div>
            <h2>Discover</h2>
            <Link href="/browse?type=MOVIE">Ghanaian Movies</Link>
            <Link href="/browse?type=SERIES">Series &amp; Programmes</Link>
            <Link href="/browse?type=DOCUMENTARY">Documentary Vault</Link>
          </div>
          <div>
            <h2>Navigation</h2>
            <Link href="/">Home Screen</Link>
            <Link href="/browse">Browse Catalogue</Link>
            <Link href="/plans">Subscription Plans</Link>
            <Link href="/search">Search Engine</Link>
          </div>
          <div>
            <h2>Your GhanaVerse</h2>
            <Link href="/account">Account &amp; Subscription</Link>
            <Link href="/profiles">Viewer Profiles</Link>
            <Link href="/library">My Library</Link>
          </div>
        </div>
        <div className="gv-subscription-footer-bottom">
          <span>
            © {new Date().getFullYear()} GhanaVerse Media. All rights reserved.
          </span>
          <span>● Ghanaian Cinema First</span>
        </div>
      </footer>
    </div>
  )
}
