"use client"
import Link from "next/link"
import Image from "next/image"
import { authClient } from "@/lib/auth-client"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { QueryState } from "@/components/common/query-state"
import { useBilling } from "@/services/billing/client"
import { CheckoutSteps } from "./checkout-steps"
import { billingDate, money } from "@/lib/billing-format"

const freeFeatures = [
  "Browse the Ghanaian catalogue and curated collections",
  "Watch available free titles and public trailers",
  "Keep your watchlist and continue watching",
  "Personalized viewer profiles and Kids mode",
]
const premiumFeatures = [
  "Access to available licensed premium titles",
  "Private video playback on the web",
  "One pass for your existing viewer profiles",
  "Saved progress across movies and episodes",
  "Ghana Mobile Money and card payments",
  "30 days of access with manual renewal",
]
function Features({
  items,
  premium = false,
}: {
  items: string[]
  premium?: boolean
}) {
  return (
    <ul
      className={`gv-sub-features ${premium ? "gv-sub-premium-features" : ""}`}
    >
      {items.map((item) => (
        <li key={item}>
          <MaterialSymbol icon="check_circle" />
          {item}
        </li>
      ))}
    </ul>
  )
}
export function PlansContent() {
  const { data: session } = authClient.useSession()
  const query = useBilling(Boolean(session))
  const data = query.data
  if (!data)
    return (
      <div className="gv-subscription-plans">
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={query.refetch}
        />
      </div>
    )
  const mode = data.configuration.mode
  return (
    <div className="gv-subscription-plans">
      <CheckoutSteps current={1} />
      <div className="gv-subscription-intro">
        <span className="gv-sub-badge">
          ● GHANAVERSE MEMBERSHIP{" "}
          {mode === "test" ? "· PAYSTACK TEST MODE" : ""}
        </span>
        <h1>
          Choose the plan that fits your
          <br className="hidden sm:block" /> Ghanaian streaming journey
        </h1>
        <p>
          Discover Ghanaian cinema, culture, and modern storytelling. Keep
          exploring for free, or unlock available exclusive titles with Premium
          Pass.
        </p>
        <span className="gv-sub-period">
          30-day access · Renew when you choose
        </span>
      </div>
      <div className="gv-sub-plan-grid">
        <section className="gv-sub-card gv-sub-plan-card">
          <span className="gv-sub-badge muted w-fit">CULTURAL EXPLORER</span>
          <div>
            <h2>Free Access</h2>
            <p>
              Discover the catalogue, watch trailers, and enjoy titles offered
              free.
            </p>
          </div>
          <div className="gv-sub-price">
            GHS 0 <small>/ forever</small>
          </div>
          <Features items={freeFeatures} />
          <Link href="/browse" className="gv-sub-button secondary">
            Explore Free Access <MaterialSymbol icon="arrow_forward" />
          </Link>
        </section>
        <section className="gv-sub-card gv-sub-plan-card premium">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="gv-sub-badge">★ PREMIUM GHANAIAN STORIES</span>
            <span className="text-[10px] text-green-700">
              ● Mobile Money &amp; cards
            </span>
          </div>
          <div>
            <h2>GhanaVerse Premium Pass</h2>
            <p>
              Your pass to available exclusive films, series, and programmes.
            </p>
          </div>
          <div className="gv-sub-price-band gv-sub-price">
            {money(data.plan.amount)} <small>/ {data.plan.days} days</small>
          </div>
          <Features premium items={premiumFeatures} />
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <strong className="text-xs">You control your renewal</strong>
              <p>No automatic debit.</p>
              {data.access.active ? (
                <p>Current expiry: {billingDate(data.access.expiresAt)}</p>
              ) : null}
            </div>
            <Link href="/plans?step=payment" className="gv-sub-button">
              {data.access.active ? "Renew access" : "Make payment"}{" "}
              <MaterialSymbol icon="bolt" />
            </Link>
          </div>
        </section>
      </div>
      <section className="gv-sub-card gv-sub-panel gv-sub-creator">
        <div className="gv-sub-creator-art">
          <Image
            src="/images/subscription-director.jpg"
            alt="A Ghanaian filmmaker working behind a camera"
            fill
            sizes="(max-width: 767px) 90vw, 440px"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 to-transparent" />
          <div className="relative mt-32 grid">
            <small>GHANAIAN CULTURAL PRESERVES</small>
            <strong>Stories deserve support.</strong>
          </div>
        </div>
        <div>
          <span className="gv-sub-badge green">● FIXED CONTENT LICENSING</span>
          <h2>
            Every Premium Pass helps sustain a home for Ghanaian storytelling.
          </h2>
          <p>
            GhanaVerse licenses premium content from participating rights
            holders under agreed fixed-fee contracts. Subscription revenue
            supports these agreements, platform operations, and continued
            maintenance.
          </p>
          <div className="gv-sub-creator-stats">
            <div>
              <strong>Agreed</strong>
              <span>Licensing fees</span>
            </div>
            <div>
              <strong>Clear</strong>
              <span>Payment records</span>
            </div>
            <div>
              <strong>Local</strong>
              <span>Creative voices</span>
            </div>
          </div>
        </div>
      </section>
      <section className="gv-sub-faq">
        <h2>Frequently Asked Questions</h2>
        <p>Everything you need to know about payment and streaming access.</p>
        {[
          [
            "Can I pay using Ghana Mobile Money?",
            "Yes. Paystack checkout offers available Ghana Mobile Money networks, including MTN, Telecel, and AT Money. Authorization happens through Paystack and your handset.",
          ],
          [
            "Does my Premium Pass renew automatically?",
            "No. Each successful payment gives you 30 days. Renew early to extend your current expiry, or return when you are ready.",
          ],
          [
            "What can I watch with Premium Pass?",
            "Available published premium titles with an active streaming licence. Availability can change when licensing periods end. Trailers and free titles remain accessible without a paid pass.",
          ],
          [
            "How are creators paid?",
            "Participating rights holders receive fixed licensing fees under their agreements. Fees are not calculated from views, and there is no promised percentage of your individual subscription.",
          ],
        ].map(([title, answer]) => (
          <details key={title}>
            <summary>{title}</summary>
            <p>{answer}</p>
          </details>
        ))}
      </section>
    </div>
  )
}
