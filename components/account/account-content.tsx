"use client"
import { useAccount } from "@/services/viewer/account"
import { QueryState } from "@/components/common/query-state"

import { PersonalDetailsForm } from "./personal-details-form"
import { PhoneSettings } from "./phone-settings"
import { PersonAvatar } from "@/components/catalogue/content-artwork"
import Link from "@/components/common/app-link"
import { SignOutButton } from "@/components/auth/sign-out-button"
import { PasswordForm } from "./password-form"
import { useState, type ReactNode } from "react"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { useBilling } from "@/services/billing/client"
import { billingDate, money } from "@/lib/billing-format"

export function AccountContent() {
  const query = useAccount()
  const billing = useBilling()
  const [passwordOpen, setPasswordOpen] = useState(false)
  if (!query.data)
    return (
      <QueryState
        kind="account"
        pending={query.isPending}
        error={query.error}
        retry={query.refetch}
      />
    )
  const user = query.data,
    profiles = user.profiles,
    active = profiles.find((profile) => profile.id === user.activeId)
  return (
    <div className="gv-subscription-account">
      <p className="gv-sub-breadcrumb">
        <Link href="/">⌂ Home</Link> / Account Settings
      </p>
      <div className="gv-sub-account-heading">
        <div>
          <h1>Account &amp; Subscription</h1>
          <p>
            Manage your GhanaVerse membership, personal details, linked viewer
            profiles, and security preferences.
          </p>
        </div>
        <span
          className={`gv-sub-badge ${billing.data?.access.active ? "green" : ""}`}
        >
          {billing.data?.access.active
            ? "● Active Premium Pass"
            : "GhanaVerse Member"}
        </span>
      </div>
      <PersonalDetailsForm compact key={user.id} user={user} />
      <PhoneSettings
        key={`${user.id}:${user.phone}:${user.phoneVerifiedAt}:${user.transactionalSmsConsent}`}
        user={user}
      />
      <section className="gv-sub-card">
        <SectionHeading
          icon="credit_card"
          title="Subscription & Billing"
          description={`${billing.data?.configuration.mode === "test" ? "Paystack Sandbox · " : ""}30-day prepaid access · Manual renewal`}
          action={
            billing.data ? (
              <span
                className={`gv-sub-badge ${billing.data.access.active ? "green" : "muted"}`}
              >
                {billing.data.access.active
                  ? `● Active · Expires ${billingDate(billing.data.access.expiresAt)}`
                  : billing.data.payments.some((p) => p.status === "SUCCESS")
                    ? "Expired · Renew access"
                    : "Free Access"}
              </span>
            ) : undefined
          }
        />
        {!billing.data ? (
          <QueryState
            kind="account"
            pending={billing.isPending}
            error={billing.error}
            retry={billing.refetch}
          />
        ) : (
          <>
            <div className="gv-sub-inset gv-sub-membership">
              <div>
                <span className="gv-sub-badge">PREMIUM PASS</span>
                <h3>GhanaVerse Premium Pass</h3>
                <p>
                  Available exclusive Ghanaian films, series, and programmes.
                </p>
                <div className="flex flex-wrap gap-4 text-[11px]">
                  <span>✓ Licensed private playback</span>
                  <span>✓ Your existing profiles</span>
                  <span>✓ No automatic debit</span>
                </div>
              </div>
              <div>
                <div className="gv-sub-price">
                  {money(billing.data.plan.amount)}
                </div>
                <p className="text-right">for {billing.data.plan.days} days</p>
                <Link
                  href="/plans#payment"
                  className="gv-sub-button gv-sub-button-outline mt-2"
                >
                  {billing.data.access.active
                    ? "Renew access"
                    : "View Premium Pass"}
                </Link>
              </div>
            </div>
            <div className="mt-7 flex items-center justify-between">
              <h3 className="text-[11px]! font-normal! uppercase">
                Recent Billing Activity
              </h3>
              <button
                className="text-[11px] text-primary"
                onClick={() => void billing.refetch()}
              >
                Refresh status
              </button>
            </div>
            {!billing.data.payments.length ? (
              <p className="mt-5">
                No payments yet. Your verified payments and receipts will appear
                here.
              </p>
            ) : (
              billing.data.payments.map((payment) => (
                <div key={payment.id} className="gv-sub-receipt-row">
                  <div className="flex gap-3">
                    <MaterialSymbol
                      icon="receipt_long"
                      className="text-primary"
                    />
                    <div>
                      <strong className="font-medium">
                        {money(payment.amount)} ·{" "}
                        {payment.status.replaceAll("_", " ")}
                      </strong>
                      <small>
                        {billingDate(payment.paidAt ?? payment.createdAt)} ·{" "}
                        {payment.channel.replaceAll("_", " ")}
                      </small>
                      <small className="break-all">
                        Paystack Reference: {payment.reference}
                      </small>
                      {payment.reviewRequired ? (
                        <small className="text-amber-800!">
                          Adjustment under review
                        </small>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`gv-sub-badge ${payment.status === "SUCCESS" ? "green" : "muted"}`}
                    >
                      {payment.status}
                    </span>
                    {payment.status === "PENDING" ? (
                      <Link
                        href={`/plans/result?reference=${encodeURIComponent(payment.reference)}`}
                        className="text-primary"
                      >
                        Check payment
                      </Link>
                    ) : null}
                    <Link
                      href={`/plans/receipt/${encodeURIComponent(payment.reference)}`}
                      className="text-primary"
                    >
                      Receipt
                    </Link>
                  </div>
                </div>
              ))
            )}
            <p className="gv-sub-note mt-5">
              Payments are processed by Paystack. Your access expires unless you
              choose to renew.
            </p>
          </>
        )}
      </section>
      <section className="gv-sub-card">
        <SectionHeading
          icon="group"
          title={`Viewer Profiles (${profiles.length} of 5 Used)`}
          description="Each profile has its own viewing history, watchlist, and preferences."
          action={<Link href="/profiles">Manage Profiles →</Link>}
        />
        <div className="gv-sub-profile-grid">
          {profiles.map((profile) => (
            <div key={profile.id} className="gv-sub-inset gv-sub-profile">
              <PersonAvatar
                name={profile.name}
                src={profile.image}
                className="h-16 w-16"
              />
              <strong>{profile.name}</strong>
              <small>
                {profile.id === active?.id
                  ? "Active profile"
                  : "Viewer profile"}
              </small>
              <span
                className={`gv-sub-badge ${profile.isKids ? "green" : "muted"}`}
              >
                {profile.isKids ? "Kids · U & PG" : "General viewing"}
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="gv-sub-card">
        <SectionHeading
          icon="tune"
          title="Security & Playback Preferences"
          description="Manage your password and the preferences of your viewing profiles."
        />
        <div className="gv-sub-security-grid">
          <div className="gv-sub-inset">
            <div>
              <small className="text-[10px] text-slate-600 uppercase">
                Account password
              </small>
              <p className="mt-2">Change your sign-in password securely.</p>
            </div>
            <button
              className="gv-sub-button gv-sub-button-outline ml-auto"
              aria-expanded={passwordOpen}
              onClick={() => setPasswordOpen(!passwordOpen)}
            >
              {passwordOpen ? "Close" : "Change"}
            </button>
          </div>
          <div className="gv-sub-inset">
            <div>
              <small className="text-[10px] text-slate-600 uppercase">
                Playback preferences
              </small>
              <p className="mt-2">
                Autoplay, available subtitles, and Kids mode.
              </p>
            </div>
            <Link
              className="gv-sub-button gv-sub-button-outline"
              href="/profiles"
            >
              Customize
            </Link>
          </div>
        </div>
        {passwordOpen ? <PasswordForm /> : null}
      </section>
      <section className="gv-sub-card gv-sub-session">
        <div className="gv-sub-section-heading mb-0!">
          <span>
            <MaterialSymbol icon="power_settings_new" />
          </span>
          <div>
            <h2>Session Controls</h2>
            <p>Protect your account when using shared devices.</p>
          </div>
        </div>
        <SignOutButton />
      </section>
    </div>
  )
}
function SectionHeading({
  icon,
  title,
  description,
  action,
}: {
  icon: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <div className="gv-sub-section-heading">
      <span>
        <MaterialSymbol icon={icon} />
      </span>
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {action ? <div className="gv-sub-heading-action">{action}</div> : null}
    </div>
  )
}
