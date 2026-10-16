# GhanaVerse

Next.js App Router application using PostgreSQL/Prisma, Better Auth, Axios, TanStack Query, React Hook Form/Zod, Material Symbols, and Cloudinary artwork uploads.

## Run locally

Use Node.js and the pnpm version declared in `package.json`.

```powershell
pnpm install
Copy-Item .env.example .env
# Configure the private environment variables described below.
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm db:seed
pnpm dev
```

Open <http://localhost:3000>. Sign in at `/auth?callbackUrl=%2Fadmin` with the administrator email and password configured in your private environment file. Existing installations should retain their configured `.env` instead of replacing it.

Required: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `SEED_ADMIN_EMAIL`, and `SEED_ADMIN_PASSWORD` (any non-empty value). `SEED_ADMIN_NAME` is optional. The seed creates the administrator and reference genres, languages, and classifications; it creates no demo users or catalogue titles. Sign-in accepts short seeded administrator passwords; viewer registration requires at least eight characters.

Artwork requires `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET`. These are server-only. Without them, drafts remain usable and uploads return an explicit unavailable response. `YOUTUBE_API_KEY` is only needed for trailer search; a YouTube video ID or URL can be entered directly.

Private R2 video uploads require the five `R2_*` values in `.env.example`. Follow the [R2 setup and recovery guide](docs/R2_VIDEO_SETUP.md) to configure bucket permissions, CORS, and the seven-day multipart lifecycle. Administrators use `/admin/storage`; linked rights holders manage their own titles at `/creator/content`. Prepared MP4 files upload directly to R2, with an 8 GB shared allowance including unfinished reservations. Playback URLs are issued only after authorization.

`pnpm video:storage:check` verifies a tiny temporary object; `pnpm video:storage:cleanup` retries expiration and deletion cleanup. `pnpm qa:video` runs real movie and episode uploads, preview, playback, renewal, and controlled multipart recovery against a running local app and configured R2 bucket, then removes its temporary fixtures. Its MDN CC0 sample and results are saved under ignored `artifacts/implementation-qa/r2`.

## Development and checks

```powershell
pnpm lint
pnpm typecheck
pnpm db:validate
pnpm test:prepare
pnpm test
pnpm build
```

`test:prepare` migrates the `ghanaverse_test` schema configured by `TEST_DATABASE_URL`. On Windows, `pnpm test:prepare --local` provisions an isolated PostgreSQL instance using the installed tools, bound to `127.0.0.1:55439`, with generated data ignored under `.test-postgres`. Later prepare runs restart it when needed. Stop it with `pnpm exec tsx scripts/test-database.ts --stop-local`. Tests refuse to run against the development `public` schema. The current `prebuild` generates Prisma and runs `db:migrate` (`prisma migrate dev`) before compiling the application. Production migrations should use `pnpm exec prisma migrate deploy` against the intended production database.

Install the browser once with `pnpm exec playwright install chromium`. `pnpm qa:browser` runs the administrator acceptance flow against a running local server, including a live Cloudinary artwork upload. It creates temporary QA records, captures desktop/mobile screenshots under `artifacts/implementation-qa`, and removes its fixture records and uploaded provider image afterward.

`pnpm qa:viewer` verifies registration, profile editing/selection and refresh, owned account/library queries, watchlist changes, access restrictions, and logout with temporary fixtures.

`pnpm qa:rights` verifies administrator-created rights-holder accounts, content ownership, YouTube-link detection, minutes conversion, immediate stream counting, reports and CSV export against the running local server. It uses a simulated YouTube API for deterministic checks, decodes a generated native video, and separately attempts live YouTube playback. Temporary QA records are removed afterward. See [rights-holder and analytics guide](docs/RIGHTS_PLAYBACK_ANALYTICS.md) for access rules, metrics, and future revenue options.

## Database backup and reset

`pnpm db:backup` creates an ignored PostgreSQL archive, checks its table-data listing, and records its SHA-256 checksum. PostgreSQL 18 tools are discovered through `POSTGRES_BIN`, defaulting to the installed Windows PostgreSQL directory.

`pnpm db:reset:verified` clears the development schema only after checking the verified archive and target fingerprint. Then apply migrations and run the seed. A reset consumes its backup verification; take a new backup before another reset. Never use the reset command against a database whose data you intend to retain.

See [architecture and administrator workflows](docs/ARCHITECTURE.md), [verification results](docs/VERIFICATION.md), and [changed-file inventory](docs/CHANGES.md).
