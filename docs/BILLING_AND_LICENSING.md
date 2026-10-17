# Premium Pass and creator licensing

GhanaVerse offers a prepaid Premium Pass, initially GHS 45 for exactly 30 days. This is a provisional, editable price awaiting commercial validation. There are no automatic debits or annual plans. A verified early renewal extends the last non-revoked grant; an expired account starts from verification. Access belongs to the account and covers its existing profiles, subject to Kids restrictions.

## Configuration and release

Keep existing private environment values. Add `PAYSTACK_SECRET_KEY` using a Paystack test key for development. `PAYSTACK_PUBLIC_KEY` can be retained but hosted checkout does not expose or require it in the browser. `NEXT_PUBLIC_APP_URL` must be the correct application origin; live checkout requires HTTPS. Never put the secret key in a public variable or commit it.

Apply the additive migration to the intended database using `pnpm db:deploy` before deploying this application version. `pnpm build` generates Prisma and builds the app; it no longer runs development migrations. No reset is required. New financial relations deliberately prevent deletion of referenced users, titles, rights holders, or payment records.

In Paystack's environment-specific dashboard, set the webhook to `https://<your-host>/api/webhooks/paystack`. Localhost cannot receive public webhooks. The callback verifies payments independently so interrupted webhook delivery does not prevent recovery. Signatures use the unmodified request body and the environment's secret key.

Live checkout remains off unless `BILLING_LIVE_ENABLED=true`, checkout is enabled in administrator pricing, commercial pricing is confirmed there, and the catalogue has a published premium title with an active approved licence and ready private video. Set these only after merchant approval, production webhook/configuration checks, content agreements, commercial validation, and a controlled live payment check. Test-mode success is not proof of live payment readiness.

Live transfers independently require `PAYOUTS_LIVE_ENABLED=true`, an approved recipient, sufficient Paystack transfer balance, and a controlled settlement check. Incoming settlements are not a guarantee that transfer balance is funded. Keep Paystack OTP protection enabled where configured; the app handles its one-time approval without retaining the code. The platform pays transfer fees separately from the fixed creator fee.

## Viewer workflow

Open `/plans`, choose Mobile Money or card, sign in, and continue to hosted Paystack checkout. Phone/network authorization and card information are handled by Paystack. Returning from checkout is not itself evidence of payment: the server checks reference, recorded amount/currency, customer email, ownership, and environment against Paystack.

The result page offers an explicit status refresh for pending or interrupted payments. `/account` lists the latest 50 owned payment records and receipt links. Receipts can be printed or saved as PDF using the browser. They record payment status and are not tax invoices. Failed or abandoned payments never grant access.

Full verified refunds and accepted or automatically accepted resolved chargebacks revoke only the linked grant. Other purchased intervals keep their original dates; revoking an earlier interval can therefore leave a gap before a later scheduled interval. Partial refunds retain access and are flagged for administrator review. Administrators must review the current adjustment amount before acknowledging it. Financial history is retained. Provider dashboard actions should be followed by webhook delivery/replay and reconciliation.

## Licensing and payout workflow

1. Register a rights holder and assign it to a title. Administrators alone control premium designation.
2. In `/admin/royalties`, record the contract reference, commercial-use permission, licence window, fixed fee, and payment due date. Dates are entered in UTC. Save the draft and explicitly approve the commercial licence.
3. Upload and enable ready managed private video. Premium publication requires an active approved licence and ready private playback; premium YouTube/direct-link playback is rejected. Preview permissions remain independent of paid viewer access.
4. A linked rights holder can register a Ghana bank or Mobile Money recipient from `/creator/earnings`; administrators can also register recipients. Bank names are resolved where supported. Mobile Money ownership requires administrator confirmation against the agreement. Only masked account details and provider recipient identifiers are stored.
5. Confirm the recipient, approve the fixed fee, review its amount/destination, and explicitly send it. Enter the provider OTP if requested. The app records success only after provider verification. Failed or reversed transfers remain in history.
6. Refresh provider status for uncertain transfers. The recovery action first verifies the existing reference and resubmits that same reference only if Paystack reports it missing. Never create another payout while an earlier attempt is unresolved.

Recipient replacement cancels approvals that have not been sent; in-flight attempts retain their original destination. Revoking streaming permission stops viewing but does not erase contractual fee records. Statements and payout history are restricted to linked organizations. There is no watch-based royalty allocation or percentage promise.

## Playback limitations

Every premium source request checks the current pass, licence, publication, source and profile restrictions. Premium signatures last at most five minutes and never extend beyond pass/licence expiry. The player renews its URL and stops at access expiry. A signed URL is a temporary bearer credential, not DRM: already buffered/downloaded media and in-flight transfers cannot be recalled. Revocation blocks new authorization; existing issued signatures can remain usable for their remaining lifetime.

## Interfaces and design references

`/api/billing` reads owned billing information; `/api/billing/plans` reads public plan information; `/checkout` initializes an order; `/verify` reconciles an owned reference; `/receipt/<reference>` reads an owned receipt. `/api/admin/billing` handles pricing, agreements, recipient approval, payout approval/send/OTP/reconciliation, and recent payments. `/api/creator/earnings` exposes only linked agreements/statements and recipient registration. Append `?format=csv` for the full scoped licensing statement. Lists show the most recent 200 agreements; the CSV includes all agreements.

The visual authorities are `../Designs/subscriptions/v06_subscription_plans_payment/{screen.png,code.html}` and `../Designs/subscriptions/v09_account/{screen.png,code.html}` relative to this app. Layout follows those references; copy reflects prepaid access, actual data, and supported capabilities. Unsupported sample promises and actions are omitted.

## Verification

Run `pnpm test:prepare --local`, then `pnpm test`, `pnpm lint`, `pnpm typecheck`, `pnpm db:validate`, and `pnpm build`. Billing tests use an isolated schema and mocked provider responses to cover adverse and concurrent outcomes. No production database is used for these tests.

`pnpm qa:billing` targets a running local app at `http://localhost:3002` (override `BILLING_QA_URL`) that must be configured with `TEST_DATABASE_URL` as its database. It creates and removes temporary accounts and saves screenshots/results under ignored `artifacts/implementation-qa/billing`. Do not point it at the production host. Provider test transfers do not demonstrate real settlement; live collection/settlement acceptance remains separate.

`pnpm qa:billing:provider` additionally uses the actual configured Paystack test API and official test card on the hosted page. It refuses live keys and nonlocal app URLs. Use `pnpm qa:billing:provider -- --headed` for a visible browser when human verification is required; complete that verification yourself. The script never solves verification challenges. The provider may require a browser executable installed through Playwright or Microsoft Edge. Do not treat a blocked hosted checkout as a successful charge. See `BILLING_VERIFICATION.md` for the completed checks and remaining acceptance work.

References: [Paystack transactions](https://paystack.com/docs/api/transaction/), [webhooks](https://paystack.com/docs/payments/webhooks/), [transfers](https://paystack.com/docs/transfers/single-transfers/), [test payments](https://paystack.com/docs/payments/test-payments/), [YouTube playback policy](https://developers.google.com/youtube/terms/developer-policies).
