"use client"
import Link from "next/link"
import { MaterialSymbol } from "@/components/common/MaterialSymbol"
import { billingDate, money } from "@/lib/billing-format"
import { usePaymentVerification } from "@/services/billing/client"
import { CheckoutSteps } from "./checkout-steps"

export function PaymentResult({ reference }: { reference: string }) {
  const query = usePaymentVerification(reference)
  const result = query.data
  const confirming = Boolean(reference && (query.isPending || query.isFetching))
  const success = !query.error && !confirming && result?.active
  const paid = result?.status === "SUCCESS"
  const pending = result?.status === "PENDING"
  const title = !reference
    ? "Payment reference missing"
    : confirming
      ? "Confirming your payment…"
      : query.error
        ? "Payment verification unavailable"
        : success
          ? result.renewal
            ? "Your Premium access has been extended"
            : "Welcome to the exclusive side of GhanaVerse"
          : paid
            ? "This payment no longer provides active access"
            : pending
              ? "Your payment is still pending"
              : "Your payment was unsuccessful"
  return (
    <div className="gv-subscription-plans">
      <CheckoutSteps current={3} />
      <section
        className="gv-sub-card gv-sub-receipt gv-checkout-result text-center"
        aria-busy={confirming}
      >
        <MaterialSymbol
          icon={
            success
              ? "check_circle"
              : confirming || pending
                ? "hourglass_top"
                : "error"
          }
          className={`text-6xl ${success ? "text-green-700" : "text-primary"}`}
        />
        <div role="status" aria-live="polite">
          <h1 className="mt-5 text-3xl font-bold">{title}</h1>
          <p className="mt-4">
            {!reference
              ? "Open the payment from your account history to check its owned reference."
              : confirming
                ? "Please wait while GhanaVerse confirms this payment with Paystack and checks your access."
                : query.error
                  ? query.error.message
                  : success
                    ? `${money(result.amount)} received. ${result.renewal ? "Your renewal adds" : "Your pass includes"} ${result.days} days, with manual renewal.`
                    : paid
                      ? "Your payment was received, but its access period has ended or is unavailable. Review your account to renew."
                      : pending
                        ? "Paystack has not confirmed this payment yet. Check its status before making another payment."
                        : "This payment has not activated Premium access. You can return to payment details to try again."}
          </p>
        </div>
        {success ? (
          <dl className="gv-checkout-confirmation">
            <div>
              <dt>Amount paid</dt>
              <dd>{money(result.amount)}</dd>
            </div>
            <div>
              <dt>Premium access expires</dt>
              <dd>{billingDate(result.access.expiresAt)}</dd>
            </div>
          </dl>
        ) : null}
        {reference ? (
          <p className="mt-3 text-xs break-all text-slate-500">
            Reference: {reference}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {success ? (
            <Link href="/browse" className="gv-sub-button">
              Start exploring
            </Link>
          ) : null}
          {reference && !confirming && (query.error || pending) ? (
            <button
              className="gv-sub-button"
              onClick={() => void query.refetch()}
            >
              Check payment status
            </button>
          ) : null}
          {reference && !confirming && !query.error && !pending && !success ? (
            <Link href="/plans?step=payment" className="gv-sub-button">
              Return to payment details
            </Link>
          ) : null}
          {paid && !query.error && !confirming ? (
            <Link
              href={`/plans/receipt/${encodeURIComponent(reference)}`}
              className="gv-sub-button gv-sub-button-outline"
            >
              View receipt
            </Link>
          ) : null}
          <Link href="/account" className="gv-sub-button gv-sub-button-outline">
            Account &amp; subscription
          </Link>
        </div>
      </section>
    </div>
  )
}
