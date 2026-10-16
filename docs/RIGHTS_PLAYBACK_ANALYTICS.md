# Rights-holder accounts and viewing analytics

Administrators create rights-holder accounts from **Users → Create rights holder**. A contact name, login email, initial password, and rights-holder/business name are required. Phone, address, website, and private notes are optional. Choose an existing rights holder to give another team member access to the same organization. Duplicate emails require explicitly managing the existing account rather than replacing its password.

The administrator shares initial credentials directly. Account holders can change their password from Account; other sessions are revoked. Public registration always creates viewers. Administrators grant `RIGHTS_HOLDER` plus organization memberships; both are required for owner reports. Suspending an account or removing its role/memberships removes access. Catalogue credits and contact-email matches do not grant report access.

Assign the organization in the content editor's Rights tab. Linked account names identify its contacts. Episodes inherit the series' rights holder. Existing rights-holder records without accounts remain valid metadata. Private contact information and notes are excluded from public catalogue responses and viewing reports.

## Playback and metrics

Paste a YouTube URL into Media & Playback to automatically select YouTube playback, including when the initial source is REMOTE_URL. Existing remote YouTube links work without changing asset IDs or saved positions. Direct URLs must point to browser-supported media, not webpages. Embedded YouTube videos remain free; paid content needs a separately licensed delivery source. Full viewing requires sign-in; discovery and trailers remain public.

The duration field accepts minutes, including fractions: 37.5 minutes is stored as 2250 seconds. Existing stored seconds are unchanged.

- A stream is recorded on the first playback-start event in each viewing session, with no minimum viewing duration. Opening a page or failing before playback starts does not count.
- Pause/resume, buffering, seeking, and replay in the same session do not add streams. Reopening and starting the video creates a new session. Idempotency keys prevent request retries from creating duplicates.
- Active watch time is sampled about every 15 seconds and flushed at relevant player/page events. Paused, buffering, hidden-page time and seek jumps are excluded. Genuine replays add watch time.
- Completion requires 90% unique timeline coverage in a session; reaching the end by seeking does not establish completion. Resume-position completion remains a separate personal-library feature.
- Reports use UTC event dates and offer 7/30/90-day or all-time filters and CSV exports. Stream starts and watch samples are independent, so an immediate stream may have zero saved watch time. Average duration uses sessions active in the selected period. Series totals include episodes; episode rows are breakdowns and should not be added to parent totals.

These are GhanaVerse estimates, not official YouTube statistics or financial settlement records. Browser closures, blocked requests, network failures and client-controlled telemetry can affect measurements. Historical progress records are not backfilled into analytics. Official YouTube reporting requires separate owner authorization.

## Interfaces and verification

`POST /api/admin/users` creates a rights-holder account and its linked records transactionally without signing out the administrator. Existing user PATCH operations manage roles and organization memberships. `POST /api/playback/sessions` records an authenticated stream; `PUT /api/progress` accepts optional sequenced viewing telemetry. `/api/admin/analytics` and `/api/creator/analytics` support `range`, optional `contentId`, and `format=csv`. Ownership restrictions apply equally to JSON and CSV. Rights-holder reports are available at `/creator/analytics`.

Use `pnpm test:prepare --local` before database tests. New verification lives in `tests/playback-metrics.test.ts`, `tests/rights-playback-analytics.test.ts`, and `scripts/rights-playback-qa.ts`. The browser script uses temporary records, tests the administrator creation/media forms, simulates YouTube's player API for deterministic counting checks, and separately checks native video decoding and live YouTube availability. It removes its records and writes results/screenshots under ignored `artifacts/implementation-qa`.

## Future revenue options

1. Free YouTube catalogue: eligible video owners retain their YouTube advertising earnings. GhanaVerse receives no automatic share from embedding; platform sponsorship or promotion would need separate agreements and compliant placement.
2. Licensed premium catalogue: subscription revenue could support operations and a rights-holder pool allocated under agreed, auditable royalty rules. Viewing analytics alone do not establish money owed.
3. Fixed licensing: negotiate a fixed fee with optional performance bonuses for predictable producer income.

Pricing, royalty percentages, verified payment revenue, payouts and commercial agreements are future work. No estimated earnings or payment processing is introduced by this release. See [YouTube embedding policies](https://developers.google.com/youtube/terms/developer-policies), [embedded advertising revenue](https://support.google.com/youtube/answer/132596?hl=en), and [owner reporting authorization](https://developers.google.com/youtube/reporting).
