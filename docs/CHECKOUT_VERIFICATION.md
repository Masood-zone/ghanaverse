# Three-step Premium checkout

Implemented locally on 17 October 2026. Production migrations were applied and verified up to date that day. The application code has not been deployed. Vercel's production billing and payout flags are true, but its Paystack key is currently test-mode.

## Behavior

- `/plans` preserves the supplied cream/orange comparison, introduction, creator support, FAQs, navigation and footer. Make payment opens step 2; active accounts see Renew access and their current expiry.
- `/plans?step=payment` requires authentication and preserves its destination through sign-in. It shows accessible network radios, locally served brand marks, a separate Card choice, account billing email, server pricing/duration and manual-renewal terms.
- Ghana Mobile Money numbers accept local and `+233` formats. Client and server share conditional Zod validation. The phone is held in component memory and the request only. Only a masked suffix and network are stored. Neither the full number nor a phone prefill is sent to Paystack.
- Hosted Paystack initialization keeps the original response contract. `channels` restricts the selected channel; `metadata.custom_filters.supported_mobile_money_providers` restricts MTN (`mtn`), Telecel (`vod`) or AT (`atl`). No direct wallet charge or popup integration was added. See [Paystack's filters and cancellation documentation](https://paystack.com/docs/payments/metadata/).
- Cancellation returns to step 2 with the owned reference. Cancellation alone does not fail an attempt. Pending attempts are reconciled before another purchase is allowed; an available checkout can be resumed with its original snapshot. Uncertain initialization retains the reference and idempotency key. Confirmed terminal attempts may start a fresh purchase.
- `/plans/result` accepts `reference` or `trxref`, restores authentication with the callback intact, and verifies once on entry. Status checks are manual. Welcome requires verified success, an unrevoked/unexpired grant for this purchase, and currently active account access. The result shows the actual paid amount and persisted expiry, with exploring, receipt and account actions. Extensions use renewal wording; old receipts cannot claim fresh active access.
- Verification refreshes billing and viewer queries. Ownership, environment matching, signed webhooks, purchase snapshots and exactly-once grants remain enforced.

## Validation

- `pnpm test:prepare`: additive migration applied only to isolated local `ghanaverse_test`.
- `pnpm test -- tests/billing.test.ts tests/billing-api.test.ts tests/auth-continuation.test.ts`: **3 files, 37 tests passed**. Includes changed phone validation, all provider filters, masked storage, cancellation return/reconciliation, welcome/expiry/renewal data and authentication return. Existing duplicate-grant and payment-mismatch tests were reused.
- `pnpm typecheck`, `pnpm lint` and `pnpm build`: **passed**. The final build compiled, passed TypeScript and generated all 53 static-page entries. Targeted ESLint also passed after the final recovery refinements.
- Browser command: `pnpm exec tsx scripts/checkout-browser-qa.ts`. It uses real local authentication, real billing summaries/receipts and an isolated test database. Initialization and result-state presentation use explicitly intercepted fixture responses; this does not establish an actual provider payment. Artifacts: `artifacts/implementation-qa/checkout/`.
- Browser acceptance **passed with no uncaught browser errors**: real sign-in returns to payment details; conditional validation, keyboard radios, local logos, phone privacy, Back/refresh and 390/1440px payment layouts pass. Duplicate submits are disabled until redirect. Fixtures cover pending/manual check, failure, verification unavailable, receipt/welcome, renewal, expired access, missing reference and callback authentication recovery. Screenshots were visually inspected at desktop/mobile widths and for the success result.
- One real test-mode attempt: Paystack accepted hosted initialization, but its checkout presented **Cloudflare human verification**. Payment completion and callback remain unverified. No repeat provider attempt or challenge bypass was performed. Evidence: `artifacts/implementation-qa/billing/provider-results.json` and `provider-failure.png`.

## Deployment and remaining acceptance

The two additive migrations, including `20261017120000_checkout_payer_intent`, have been applied to the intended production database; Prisma subsequently reported the schema up to date. The checkout migration adds nullable `mobileMoneyNetwork` and `maskedPayerPhone` columns and preserves existing payment records. Before deploying this schema-dependent code, verify the HTTPS app URL and environment-specific webhook. Live collection and payout settlement still require an approved live key and controlled acceptance checks.

Complete one human-assisted Paystack test checkout and callback, including the selected provider restriction, cancellation return and account update. Verify environment-specific callbacks and signed public webhook delivery at deployment. No live collection or payout has been performed.

## Files changed for this request

Existing unrelated worktree changes were preserved. This inventory describes this request's edits, including edits to files that were already untracked from earlier billing work:

- `app/(auth)/auth/continue/page.tsx`
- `app/(viewer)/plans/page.tsx`
- `app/(viewer)/plans/result/page.tsx`
- `components/billing/checkout-steps.tsx`
- `components/billing/payment-details.tsx`
- `components/billing/payment-result.tsx`
- `components/billing/plans-content.tsx`
- `components/billing/subscriptions.css`
- `lib/validation/billing.ts`
- `prisma/schema.prisma`
- `prisma/migrations/20261017120000_checkout_payer_intent/migration.sql`
- `public/images/payments/README.md`
- `public/images/payments/mtn-momo.svg`
- `public/images/payments/telecel-cash.jpg`
- `public/images/payments/at-money.webp`
- `scripts/checkout-browser-qa.ts`
- `scripts/billing-browser-qa.ts`
- `scripts/billing-provider-qa.ts`
- `services/billing/client.ts`
- `services/billing/payments.ts`
- `tests/auth-continuation.test.ts`
- `tests/billing.test.ts`
- `types/billing.ts`
- `docs/CHECKOUT_VERIFICATION.md`

Generated Prisma client and ignored local QA artifacts are not source files. No account-design, creator-payout, licensing or playback implementation files were changed by this request.
