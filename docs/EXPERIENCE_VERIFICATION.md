# Catalogue speed, notifications, mobile hero and loading feedback

## Implemented scope

Catalogue list/card, hero and detail reads use separate projections. Shared cards/home collections use 60-second tagged Next data caching; genre/language/classification reference data uses one hour. Audience, filters and pagination are cache arguments. Session, suspension, ownership, profiles, watchlists, progress, recommendations, premium access, licences and signed playback URLs stay outside shared caches. Home personal sections stream in independent Suspense boundaries.

Successful admin and creator mutations expire catalogue tags after their transactions commit. Metadata mutations also expire reference tags; collection mutations expire collection tags. Details/playback still read publication and authorization directly. Playback progress retains the existing coalescing and final saves; invalidation marks the library stale without repeatedly refetching it during playback.

Mobile heroes below 768px place reserved cinematic artwork above the dark content panel, use 30px full titles, readable metadata and separate actions, and replace thumbnails with compact controls. Desktop keeps its composition. Rotation is seven seconds, pausing for interaction, focus, hidden documents, trailers and reduced-motion preferences.

The gold loading bar waits 100ms and follows actual Next Link pending state, shared React router transitions, forms, route fallbacks and client query fallbacks. It stays indeterminate. Skeletons cover home, catalogue/search, title, library, account/plans, creator/admin and player routes. Upload/player progress retains its own real measurements.

See [TRANSACTIONAL_NOTIFICATIONS.md](./TRANSACTIONAL_NOTIFICATIONS.md) for notification events, additive migrations, account APIs, worker setup and remaining live delivery checks.

## Local performance measurement

`pnpm qa:catalogue:benchmark` creates and removes 24 series with six episodes each in the isolated local PostgreSQL schema. It compares the prior full-relation list against the new card projection, using real Next `unstable_cache` and `IncrementalCache`. Five samples per case; cold cache keys are distinct. These are data-service timings and serialized response sizes, excluding authentication, full HTTP rendering, network and provider delivery.

| Read | First sample | Median of five | SQL queries per sample | Serialized response |
| --- | ---: | ---: | ---: | ---: |
| Prior full relations | 620.92 ms | 55.07 ms | 17 | 72,391 bytes |
| New cold cards/cache | 37.03 ms | 8.46 ms | 6 | 10,207 bytes |
| New warm cards/cache | 1.00 ms | 0.36 ms | 0 | 10,207 bytes |

Cold database queries fell about 65%; serialized list size fell about 86%. The fixture's first legacy read includes connection warmup. Results vary by catalogue and deployment. These numbers do not measure hosting CDN hits, cache billing or production latency. Warm cache reuse introduces application-cache work while eliminating these catalogue SQL reads; account and playback authorization queries remain necessary.

Playback write scheduling is unchanged: coalesced saves at the existing 15-second interval and final saves on pause, completion and exit. The implementation removes library refetches caused by those saves. It does not claim fewer progress writes or a measured production playback-write reduction.

Raw measurements and browser artifacts are saved under `artifacts/implementation-qa/experience/` (ignored local verification output). The benchmark reconstructs the previous query/projection for comparison; no pre-change browser screenshots were captured.

## Verification

- `pnpm db:generate` and `pnpm test:prepare`: passed; additive migrations applied only to the isolated local test schema.
- `pnpm check`: passed schema validation, ESLint, TypeScript, 21 test files / 160 tests, and the production build.
- Final notification/authentication rerun: 2 files / 15 tests passed, including both creator/admin publication paths, ownership-code limits, concurrent queue claims, recipient authorization, SMTP deadlines, carrier reports and Better Auth recovery/session revocation.
- Final `pnpm build` after the last dialog/menu motion adjustment: passed, including TypeScript and all 56 generated static pages.
- `pnpm qa:catalogue:benchmark`: passed real Next cache reuse and tag invalidation. Unpublishing one of 24 fixtures and expiring its tag caused six fresh SQL queries, returned 23 cards and excluded the unpublished title.
- Browser QA against the local development server passed ten checks with zero uncaught browser errors. It covered home and account at 320/390/768/1440, long titles, artwork fallback, keyboard controls, reduced motion, trailer dialog/Escape, throttled navigation, query changes, rapid clicks, back/forward, missing titles, phone normalization, rejected unverified consent, admin redirects and a persisted admin queue at 320/1440.
- The full check emitted a PostgreSQL client concurrent-query deprecation warning; it did not fail validation. No lint rule or type check was disabled.

The pre-existing React form-control lint error was resolved by destructuring the React Hook Form callback ref, value and handlers before render. Existing untracked `AGENTS.md` and `CLAUDE.md` were preserved.

[Complete implementation touched-file list](./EXPERIENCE_TOUCHED_FILES.txt).

Local generated verification state also includes the ignored Prisma client, `.next/`, test PostgreSQL state and `artifacts/implementation-qa/experience/`. The existing `test:prepare` script manages ignored `.env` test-database configuration; provider credentials were not edited.

## Remaining live checks

No production deployment, production database migration, actual SMTP/SMS delivery or deployed worker validation was performed. Trailer playback uses a local iframe stub in browser QA; actual provider playback, licensed R2 streams and network-interruption acceptance checks remain live checks. Progress coalescing, final saves, playback samples, premium authorization and licence expiry are covered by the automated regression suite.

## Local production browser smoke

The same ten browser checks passed against the final optimized local `next start` build on port 3004, using the isolated test schema. The browser captured JavaScript exceptions and hydration-related console errors; both lists were empty. Navigation tests disabled prefetch only in the test harness and delayed RSC requests by 1.2 seconds to make pending states observable. The screenshot `after-navigation-pending-1440.png` captures the visible loading bar and fallback. Final screenshots and `after-results.json` reflect this production-build run.

Screenshots: [mobile home](../artifacts/implementation-qa/experience/after-home-390.png), [desktop home](../artifacts/implementation-qa/experience/after-home-1440.png), [pending navigation](../artifacts/implementation-qa/experience/after-navigation-pending-1440.png), [phone settings/account](../artifacts/implementation-qa/experience/after-account-390.png), [administrator queue](../artifacts/implementation-qa/experience/after-notifications-1440.png).

Temporary development/production preview processes were stopped after verification. The local test PostgreSQL instance was subsequently stopped at the user's request before commit; its data was preserved.
