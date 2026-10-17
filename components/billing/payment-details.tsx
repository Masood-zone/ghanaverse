"use client"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import Image from "next/image"
import { useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import { ApiClientError } from "@/lib/api-client"
import { checkoutSchema } from "@/lib/validation/billing"
import { billingDate, money } from "@/lib/billing-format"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { QueryState } from "@/components/common/query-state"
import {
  useBilling,
  useBillingMutation,
  usePaymentVerification,
} from "@/services/billing/client"
import type { BillingSummary } from "@/types/billing"
import { CheckoutSteps } from "./checkout-steps"

const methods = [
  { value: "mtn", title: "MTN MoMo", logo: "/images/payments/mtn-momo.svg" },
  {
    value: "telecel",
    title: "Telecel Cash",
    logo: "/images/payments/telecel-cash.jpg",
  },
  { value: "at", title: "AT Money", logo: "/images/payments/at-money.webp" },
] as const

export function PaymentDetails({ reference }: { reference: string }) {
  const query = useBilling()
  if (!query.data)
    return (
      <div className="gv-subscription-plans">
        <QueryState
          pending={query.isPending}
          error={query.error}
          retry={query.refetch}
        />
      </div>
    )
  return <PaymentForm key={reference} data={query.data} reference={reference} />
}

function PaymentForm({
  data,
  reference,
}: {
  data: BillingSummary
  reference: string
}) {
  const { data: session } = authClient.useSession()
  const client = useQueryClient()
  const [attempt, setAttempt] = useState(
    reference || data.pendingCheckout?.reference || ""
  )
  const verification = usePaymentVerification(attempt)
  const [method, setMethod] = useState(
    data.pendingCheckout?.channel === "card"
      ? "card"
      : (data.pendingCheckout?.mobileMoneyNetwork ?? "mtn")
  )
  const [phone, setPhone] = useState("")
  const [fieldError, setFieldError] = useState("")
  const [opening, setOpening] = useState(false)
  const key = useRef<string | null>(null)
  const submitting = useRef(false)
  const checkout = useBillingMutation<{ reference: string; url: string }>(
    "/billing/checkout"
  )
  const pending = data.pendingCheckout
  const terminal = verification.data && verification.data.status !== "PENDING"
  const noProviderRecord =
    verification.error instanceof ApiClientError &&
    verification.error.code === "PROVIDER_NOT_FOUND"
  const canRetryInitialization =
    noProviderRecord && pending?.reference === attempt && !pending.checkoutUrl
  const blocked = Boolean(attempt && !terminal && !canRetryInitialization)
  const paid = verification.data?.status === "SUCCESS"
  const busy = checkout.isPending || opening

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (submitting.current || blocked || paid) return
    if (terminal) key.current = null
    key.current ??=
      canRetryInitialization && pending
        ? pending.idempotencyKey
        : crypto.randomUUID()
    const input = checkoutSchema.safeParse({
      channel: method === "card" ? "card" : "mobile_money",
      idempotencyKey: key.current,
      ...(method === "card"
        ? {}
        : { mobileMoneyNetwork: method, payerPhone: phone }),
    })
    if (!input.success) {
      setFieldError(
        input.error.issues[0]?.message ?? "Check your payment details."
      )
      document.getElementById("payer-phone")?.focus()
      return
    }
    setFieldError("")
    submitting.current = true
    checkout.mutate(input.data, {
      onSuccess: (result) => {
        setOpening(true)
        setPhone("")
        window.location.assign(result.url)
      },
      onError: async () => {
        submitting.current = false
        await client.invalidateQueries({ queryKey: ["billing"] })
        const refreshed = client.getQueryData<BillingSummary>([
          "billing",
          "account",
          session?.user.id,
        ])
        if (refreshed?.pendingCheckout)
          setAttempt(refreshed.pendingCheckout.reference)
      },
    })
  }

  return (
    <div className="gv-subscription-plans">
      <CheckoutSteps current={2} />
      <Link href="/plans" className="gv-checkout-back">
        ← Back to choose your pass
      </Link>
      <section className="gv-sub-card gv-sub-payment gv-checkout-payment">
        <div className="gv-sub-panel-head">
          <div>
            <span className="gv-sub-badge muted">
              <MaterialSymbol icon="verified_user" />
              {data.configuration.mode === "test"
                ? "SECURE PAYSTACK CHECKOUT"
                : "SECURE PAYSTACK CHECKOUT"}
            </span>
            <h1 className="mt-4 text-3xl font-bold">Payment details</h1>
            <p>One pass. More Ghanaian stories. Renew when you choose.</p>
          </div>
        </div>
        {data.access.active ? (
          <p className="gv-checkout-notice">
            Your Premium Pass expires {billingDate(data.access.expiresAt)}.
            Renewing adds {data.plan.days} days to your existing access.
          </p>
        ) : null}
        {attempt ? (
          <div className="gv-checkout-notice" role="status">
            <strong>
              {verification.isFetching
                ? "Confirming your previous payment…"
                : paid
                  ? "Your previous payment was received"
                  : terminal
                    ? "Your previous payment was unsuccessful"
                    : verification.error
                      ? "Payment verification is unavailable"
                      : "Your previous payment is still pending"}
            </strong>
            <p>
              {verification.error?.message ??
                (terminal
                  ? "Review the result before continuing."
                  : "Returning from Paystack does not cancel or fail a payment. Check its status before paying again.")}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <button
                type="button"
                className="gv-sub-button secondary"
                disabled={verification.isFetching}
                onClick={() => void verification.refetch()}
              >
                Check payment status
              </button>
              {paid ? (
                <Link
                  className="gv-sub-button"
                  href={`/plans/result?reference=${encodeURIComponent(attempt)}`}
                >
                  View payment result
                </Link>
              ) : null}
              {!terminal &&
              pending?.checkoutUrl &&
              !verification.error &&
              !verification.isFetching ? (
                <a className="gv-sub-button" href={pending.checkoutUrl}>
                  Resume existing checkout
                </a>
              ) : null}
            </div>
          </div>
        ) : null}
        <div className="gv-sub-payment-grid">
          <form onSubmit={submit} noValidate>
            <fieldset disabled={busy || blocked || paid}>
              <legend className="text-sm font-semibold">
                Choose your payment method
              </legend>
              <RadioGroup
                name="payment-method"
                value={method}
                disabled={busy || blocked || paid}
                onValueChange={(value) => {
                  setMethod(value)
                  if (value === "card") setPhone("")
                  setFieldError("")
                }}
              >
                <div className="gv-sub-methods gv-checkout-networks">
                  {methods.map((item) => (
                    <Label key={item.value}>
                      <Image
                        src={item.logo}
                        alt=""
                        width={96}
                        height={48}
                        className="gv-checkout-logo"
                      />
                      <span>{item.title}</span>
                      <RadioGroupItem value={item.value} />
                    </Label>
                  ))}
                </div>
                <Label className="gv-checkout-card-option">
                  <MaterialSymbol icon="credit_card" />
                  <span>Card</span>
                  <RadioGroupItem value="card" />
                </Label>
              </RadioGroup>
              {method !== "card" ? (
                <div className="mt-6">
                  <Label htmlFor="payer-phone" className="gv-sub-field-label">
                    Mobile Money number
                  </Label>
                  <Input
                    id="payer-phone"
                    className="gv-sub-field"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    maxLength={30}
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value)
                      setFieldError("")
                    }}
                    aria-invalid={Boolean(fieldError)}
                    aria-describedby={`payer-phone-help${fieldError ? " payer-phone-error" : ""}`}
                    required
                    placeholder="024 123 4567 or +233 24 123 4567"
                  />
                  <p id="payer-phone-help" className="gv-sub-note">
                    Confirm this number again on Paystack if requested.
                  </p>
                  {fieldError ? (
                    <p
                      id="payer-phone-error"
                      className="gv-sub-error"
                      role="alert"
                    >
                      {fieldError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </fieldset>
            <Label className="gv-sub-field-label mt-6" htmlFor="billing-email">
              Account billing email
            </Label>
            <Input
              id="billing-email"
              className="gv-sub-field"
              type="email"
              value={session?.user.email ?? ""}
              readOnly
            />
            <p className="gv-sub-note">
              Your receipt uses your account email. Authorize payment securely
              on Paystack; keep your PIN private.
            </p>
            <button
              className="gv-sub-button mt-6 w-full"
              type="submit"
              disabled={busy || blocked || paid || !data.canCheckout}
            >
              <MaterialSymbol icon="lock" />
              {busy ? "Opening Paystack…" : "Continue to Paystack"}
            </button>
            {!data.canCheckout ? (
              <p role="status" className="gv-sub-note">
                Checkout is currently unavailable. You can continue enjoying
                free titles.
              </p>
            ) : null}
            {checkout.error ? (
              <div className="gv-sub-error mt-4" role="alert">
                {checkout.error.message}{" "}
                <Link href="/account" className="underline">
                  Check payment history
                </Link>
              </div>
            ) : null}
            <p className="gv-sub-note text-center">
              {data.configuration.mode === "test"
                ? "Test mode: use Paystack test details. No real funds are collected."
                : "Access starts only after server verification."}
            </p>
          </form>
          <aside className="gv-sub-summary">
            <h2>Order summary</h2>
            <div className="my-5">
              <strong>GhanaVerse Premium Pass</strong>
              <p>{data.plan.days}-day membership</p>
              <p>Manual renewal · No automatic charge</p>
            </div>
            <dl>
              <div>
                <dt>Premium Pass</dt>
                <dd>{money(data.plan.amount)}</dd>
              </div>
              <div>
                <dt>Access period</dt>
                <dd>{data.plan.days} days</dd>
              </div>
              <div>
                <dt>Total due today</dt>
                <dd className="text-primary">{money(data.plan.amount)}</dd>
              </div>
            </dl>
            <p className="gv-sub-note">
              <MaterialSymbol icon="shield" /> Payment authorization is handled
              by Paystack. Your card details and Mobile Money PIN stay outside
              GhanaVerse.
            </p>
            {pending ? (
              <p className="gv-sub-note">
                Existing attempt: {money(pending.amount)} for {pending.days}{" "}
                days
                {pending.maskedPayerPhone
                  ? ` · ${pending.maskedPayerPhone}`
                  : ""}
                . Resume uses that original order.
              </p>
            ) : null}
          </aside>
        </div>
      </section>
    </div>
  )
}
