# GhanaVerse transactional notifications

The web application records notifications in PostgreSQL. A separate Node worker delivers them through SMTP and UelloSend. Credentials and sender identities are specific to GhanaVerse; Amanah configuration is not imported.

## Install and migrate

Use the repository's pnpm version, run `pnpm install --frozen-lockfile` and `pnpm db:generate`. Against the intended application database, run `pnpm db:deploy` to apply the additive migrations:

- `20261017000100_transactional_notifications`: optional account phone/verification/consent, phone challenges, outbox and delivery states.
- `20261017140000_notification_reconciliation_note`: administrator reconciliation evidence.

No database reset or provider migration is required. Local implementation verification applies migrations only to the isolated `ghanaverse_test` schema. Production migration and deployment are separate operator actions.

## Configuration and worker

Configure server-only `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, and `SMTP_FROM` in the web process (recovery email) and worker (queued messages). Port 465 normally uses `SMTP_SECURE=true`; port 587 uses STARTTLS, which is required before authentication. The sender must be authorized by your SMTP service.

For optional SMS, configure `UELLOSEND_API_KEY`, an approved `UELLOSEND_SENDER_ID`, and optionally `UELLOSEND_API_URL` (default `https://uellosend.com/quicksend/`). Configure these in the web process for phone codes and in the worker for consenting account notifications. No credentials belong in `NEXT_PUBLIC_*` variables or client bundles.

`NOTIFICATION_TIMEOUT_MS` defaults to 10000 and is bounded between 1000 and 30000. SMTP owns its connection and closes the active socket on deadline; SMS requests use an abort deadline.

Run the worker on the same persistent Node deployment pattern as the existing video worker, with its own process/service, the same migrated `DATABASE_URL`, and `NOTIFICATION_WORKER_ENABLED=true`:

```powershell
$env:NOTIFICATION_WORKER_ENABLED = "true"
pnpm notifications:worker
```

`pnpm notifications:worker --once` performs one bounded batch for operational checks. Leave the enable flag false in previews and processes that should not drain the queue. Use a process supervisor to restart after a worker failure. SIGINT/SIGTERM stop new batches and allow the bounded current batch to finish. The worker processes at most four notifications concurrently by default, with atomic database claims and a two-minute lease.

## Events and transaction boundaries

The outbox covers welcome and password security confirmations, confirmed payments/refunds, creator publication changes, and confirmed payout results. Payment/refund/publication/payout records enqueue inside the existing business transaction. Uncertain payout outcomes alert administrators to reconcile before another transfer. Better Auth owns password-reset tokens and credential changes; its database hooks queue welcome/password confirmations after those records are written.

Email is the default channel. Optional SMS requires a phone number, successful ownership verification and explicit transactional consent. Both address and consent are checked again at send time. Suspended/deleted recipients, former administrators and former rights-holder members cannot receive queued messages requiring that access. No provider request occurs within a billing transaction, so provider failure cannot reverse a confirmed payment.

Uniqueness is `(eventKey, recipientId, channel)`. Definitive transient rejections retry with exponential backoff starting at 30 seconds, up to five attempts. Permanent rejection or exhausted retries queues an administrator alert. Alerts that themselves fail do not recursively create more alerts.

`ACCEPTED` records a provider message ID and acceptance timestamp; it does not claim inbox/carrier delivery. The worker reads UelloSend delivery receipts for accepted SMS and records `DELIVERED` only for a matching carrier report. SMTP messages remain accepted unless an external delivery system supplies additional evidence. Carrier failure alerts administrators and does not automatically resend a previously accepted message.

Timeouts, malformed success responses and expired worker leases become `AMBIGUOUS`. They remain on hold. Administrators inspect `/admin/notifications`, check provider evidence, and either record acceptance, cancel, or explicitly confirm the provider did not accept the original before retrying. Reconciliation notes and actor/action audit records are retained. The queue UI does not expose codes, tokens, credentials, or full recipient addresses.

## Account and recovery flows

`GET /api/account` includes `phone`, `phoneVerifiedAt`, and `transactionalSmsConsent`. The authenticated, same-origin account settings use:

- `PATCH /api/account/phone`: save/remove a Ghana number and transactional SMS preference. Changing the number always clears verification and consent, while retaining resend counters.
- `POST /api/account/phone/request`: reserve and send a six-digit ownership code; five-minute validity, one-minute resend delay and five requests per hour per account.
- `POST /api/account/phone/verify`: verify the current account's code, with five attempts maximum. Codes are stored as keyed hashes and are consumed once. Verification does not opt the account into SMS.

Phone ownership is not a sign-in or recovery factor. `/auth/recovery` uses Better Auth's email reset flow, one-hour single-use tokens and session revocation after reset. Existing login and suspension policies remain in force.

## Live acceptance checks still required

After deployment, verify an actual authorized SMTP message reaches an inbox, a Ghana phone receives its code, consent permits a transactional SMS, and the carrier receipt matches that message. Confirm the worker stays healthy across restart, ambiguous rows remain held, and controlled payment/refund/payout events produce the expected messages without duplicate financial operations. These checks are separate from local mocked-provider and isolated-database tests.

Provider contract: [UelloSend developer documentation](https://uellosend.com/developer.php). Recovery contract: [Better Auth email/password documentation](https://better-auth.com/docs/authentication/email-password).
