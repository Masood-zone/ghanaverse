# Authentication simplification

## Resulting architecture

Better Auth handles email/password authentication and database-backed sessions through its Prisma adapter. Prisma stores the existing `VIEWER`, `RIGHTS_HOLDER`, and `ADMIN` roles and suspension flag. No auth proxy or middleware is required.

- `role` and `isSuspended` are typed Better Auth additional fields with defaults and `input: false`. Public registration always produces an active viewer; public account updates cannot alter access fields.
- `getOptionalUser()` resolves Better Auth's validated session once per server render. It returns `{ session, user }` or `null`, rejecting suspended users without another Prisma user lookup. This is request-local React memoization, not a shared session cache. Cookie caching remains disabled.
- `requireUser()` and `requireAdmin()` retain `AUTH_REQUIRED` (401) and `ADMIN_REQUIRED` (403) API responses. Infrastructure failures propagate to the existing error boundary/response handling.
- `requireUserPage(callbackUrl)` and `requireAdminPage(callbackUrl = "/admin")` redirect unauthenticated users to sign-in with a sanitized callback. Signed-in non-administrators visiting admin pages return Home. Protected leaf pages enforce these checks before rendering their content or reading private records. Layouts only render the appropriate shell.
- Profile ownership, rights-holder memberships, publication and playback authorization remain in their existing domain services. Role/status/membership changes still revoke sessions transactionally. The session-creation suspension hook, default-profile provisioning, and last-active-admin protection remain in place.

The same-origin browser client infers these fields from the server's `Auth` type. `NEXT_PUBLIC_APP_URL` is no longer used. Keep the existing `DATABASE_URL`, `BETTER_AUTH_SECRET`, and `BETTER_AUTH_URL`; existing account records, password hashes, session cookies and database schema are retained. This change requires no migration or reset.

## Browser flow

1. The form validates input and calls Better Auth's `signIn.email` or `signUp.email`.
2. After success it cancels/clears old domain queries and navigates to `/auth/continue?callbackUrl=…`. Registration retains its one-time welcome notification.
3. That server page validates the session and reads at most two owned profile IDs. Multiple profiles open the profile picker; zero or one continues to the sanitized destination. Explicit profile-picker destinations are preserved without nesting. Missing sessions return to sign-in with the original destination.
4. Better Auth owns browser identity and cross-tab logout. The application clears domain queries when the settled identity changes and reloads the current view. Local logout retains its transient in-flight guard so API failures do not race its Home navigation. Profile switching keeps its separate notification.

## Reproduce verification

```powershell
pnpm test:prepare
pnpm db:validate
pnpm lint
pnpm typecheck
pnpm test
pnpm exec next build
pnpm qa:auth
```

`test:prepare` configures/migrates only the existing disposable test schema. The Vitest setup refuses the development schema. `qa:auth` launches its own production server on port 3100 with the test database and matching auth URL, then stops it and removes its fixture accounts. It uses no Cloudinary/R2 mutations. The ordinary `pnpm build` prebuild hook runs database migrations, which is why verification uses `pnpm exec next build` directly.

Browser evidence is written to ignored `artifacts/implementation-qa/auth`: `results.json`, `server.log`, `auth-390.png`, `last-page.png`, and `trace.zip`. Traces are local test artifacts and may contain temporary fixture credentials.

Automated regression coverage includes registration access-field protection, default profiles, missing/forged/expired/revoked/suspended sessions, admin API denial, transactional revocation, callback safety, profile routing, and existing creator/ownership invariants. Browser checks cover protected page redirects and actual form/session transitions. Production deployment, physical devices and live media providers require separate validation.

## Verified on 16 October 2026

| Check | Result |
| --- | --- |
| `pnpm db:validate` | Passed; schema unchanged |
| `pnpm lint` | Passed; final browser-script edits also passed targeted ESLint |
| `pnpm typecheck` | Passed |
| `pnpm test` | 90 tests passed across 15 files, using the isolated local schema |
| `pnpm exec next build` | Passed, with `/auth/continue` present and no proxy in the build |
| `pnpm qa:auth` | Passed all seven scenario groups, including all 20 protected pages and mobile rendering; zero browser page errors |
| `git diff --check` | Passed |

The browser run used the production build with disposable fixture accounts and the local test schema. It confirmed the complete browser → Better Auth/API → Prisma → rendered response flow. The QA harness uses `localhost` consistently to match Next.js URL normalization and honors Better Auth's `Retry-After` response without disabling rate limits. Cleanup confirmed zero remaining auth QA accounts, no listener on the QA server's port, and the disposable PostgreSQL instance was stopped afterward. The Vitest run emitted PostgreSQL client deprecation warnings; all assertions passed. Deployment and live Cloudinary/R2 behavior were not exercised by this auth upgrade.

## Changed files

- Updated: `.env.example`
- Added: `app/(auth)/auth/continue/page.tsx`
- Updated: `app/(viewer)/account/page.tsx`
- Updated: `app/(viewer)/creator/analytics/page.tsx`
- Updated: `app/(viewer)/creator/content/[id]/page.tsx`
- Updated: `app/(viewer)/creator/content/[id]/preview/page.tsx`
- Updated: `app/(viewer)/creator/content/layout.tsx`
- Updated: `app/(viewer)/creator/content/page.tsx`
- Updated: `app/(viewer)/library/page.tsx`
- Updated: `app/(viewer)/profiles/page.tsx`
- Updated: `app/admin/activity/page.tsx`
- Updated: `app/admin/analytics/page.tsx`
- Updated: `app/admin/collections/page.tsx`
- Updated: `app/admin/content/[id]/page.tsx`
- Updated: `app/admin/content/[id]/preview/page.tsx`
- Updated: `app/admin/content/page.tsx`
- Updated: `app/admin/creators/page.tsx`
- Updated: `app/admin/layout.tsx`
- Updated: `app/admin/metadata/page.tsx`
- Updated: `app/admin/page.tsx`
- Updated: `app/admin/royalties/page.tsx`
- Updated: `app/admin/storage/page.tsx`
- Updated: `app/admin/users/page.tsx`
- Updated: `components/auth/auth-form.tsx`
- Added: `components/auth/creator-access-required.tsx`
- Updated: `components/auth/use-sign-out.ts`
- Updated: `components/providers/providers.tsx`
- Updated: `docs/ARCHITECTURE.md`
- Added: `docs/AUTHENTICATION.md`
- Updated: `docs/VIEWER-EXPERIENCE.md`
- Updated: `lib/auth-client.ts`
- Updated: `lib/auth.ts`
- Updated: `lib/auth/access.ts`
- Updated: `lib/auth/callback.ts`
- Updated: `lib/auth/policy.ts`
- Updated: `package.json`
- Removed: `proxy.ts`
- Updated: `README.md`
- Added: `scripts/auth-browser-qa.ts`
- Added: `tests/auth-access.test.ts`
- Added: `tests/auth-continuation.test.ts`
- Updated: `tests/auth.integration.test.ts`
- Removed: `tests/proxy.test.ts`

The pre-existing blank line in `components/auth/use-sign-out.ts` was preserved. Generated files, build output and ignored QA artifacts are excluded from this source inventory.
