# Verification

Latest rights-holder, playback and analytics results are in [IMPLEMENTATION_VERIFICATION.md](IMPLEMENTATION_VERIFICATION.md), including the existing importer blocker. The earlier phase results below are retained as historical verification.

Verified locally on 15 October 2026. No deployment was performed.

## Automated checks

The final `pnpm check` completed successfully: Prisma schema validation, ESLint, TypeScript, all **32 tests across 9 files**, and the Next.js production build. Database tests used disposable PostgreSQL 18 on `127.0.0.1:55439`, schema `ghanaverse_test`; the development database was not used for integration tests.

Coverage includes administrator authorization, session revocation and suspension, concurrent last-administrator protection, transactional audit rollback, published-title edit restrictions, publication and episode ownership, collection order, upload validation, viewer-library privacy, registration role protection, and existing catalogue/import policies.

The PostgreSQL driver emitted upstream SSL/concurrent-query deprecation warnings. They did not fail the checks. Earlier intermittent remote database delays were isolated from the automated suite by provisioning the local disposable database.

## Administrator browser acceptance

The production server passed the complete Playwright administrator flow with no browser JavaScript errors:

- Administrator sign-in and operational dashboard.
- Creator creation, persistent editor tabs and repeated creator credits.
- Live artwork upload, persisted draft, authenticated preview and publication.
- Public-data privacy and published-title edit protection.
- Persisted collection curation, unpublish, edit and republish.
- Desktop (1440 px) and mobile (390 px) screenshots with overflow checks.
- Anonymous API/preview restrictions, logout and protected-session removal.

The desktop dashboard/users screens and mobile editor capture were visually reviewed. Captures and machine-readable reports are under `artifacts/implementation-qa`. Browser acceptance uses temporary records and removes them afterward.

## Viewer browser acceptance

The final `pnpm qa:viewer` passed against the production server with no browser JavaScript errors: registration and default profile creation; denied administrator access; React Hook Form profile editing and avatar selection; profile creation, reload and active selection; owned account queries; watchlist add/remove and library refresh; private-data-safe library responses; empty state; profile ownership rejection; and logout. Mobile profile/account captures were visually reviewed. The script removed its temporary user, titles and creator.

An initial viewer run exposed an overly strict test selector for the Add Profile button, whose accessible name also includes its helper text. The selector was corrected; the complete rerun passed. ESLint and TypeScript passed again after this QA-script adjustment. No product-code changes followed the successful full check.

## Providers and database

The previous database was archived at `.backups/2026-10-15T11-17-38-894Z/database.dump` before its authorized reset. Archive readability (`pg_restore --list`), SHA-256 and target checks were verified before clearing the development schema. All six migrations were applied and an administrator plus reference metadata seeded without demo catalogue content. A full restore drill was not performed. The old remote test schema was removed after the suite moved locally.

Live Cloudinary artwork upload, provider delivery, database persistence and fixture cleanup succeeded in administrator browser acceptance. This is separate from local image-validation tests. Full-video uploads/transcoding, third-party playback delivery, commercial subscriptions, advanced analytics and royalties remain outside this phase. Production deployment and production-service load testing have not been performed.

Final development-data inspection confirmed one administrator, zero viewer accounts/profiles, and zero titles, creators, collections or artwork records after QA cleanup. The disposable local PostgreSQL instance was stopped after verification. The application preview remains available on port 3000; subsequent test runs should start with `pnpm test:prepare`.
