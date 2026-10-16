# R2 video implementation and verification

Verified on 16 October 2026. Monetization remains outside this change. No production deployment was performed. Git revisions are recorded in the release handoff history.

## Implemented flow

Administrators and organization-linked rights holders share a sectioned editor. Owners can manage their own movies, seasons and episodes, upload artwork, preview media, and self-publish. Server-side membership, suspension, publication and protected-field checks apply to every mutation. Existing external and YouTube sources remain supported.

Prepared fast-start H.264/AAC MP4 files upload directly from the browser to a private R2 bucket. Saved sessions, part checksums and quota reservations support recovery for seven days. Transfers use 16 MiB parts, three concurrent requests, five automatic retries and cross-tab Web Locks. A persistent drawer separates confirmed progress from bytes in flight. Browser storage contains identifiers and file metadata, never video files or provider credentials.

Completion verifies R2's actual parts, checksum aggregate, object size and MP4 metadata before attaching a disabled managed source. Source selection is explicit. Replacement preserves the managed video asset ID and counts the old file until deletion is confirmed. Cleanup retries expiration, pending deletion and detached-object reconciliation; unrelated bucket keys are preserved.

Viewer source requests check publication, active profile ownership, Kids restrictions, premium availability, enabled playback and managed-object readiness. Signed URLs expire after one hour. Native-player renewal preserves position, playback intent and the analytics hook/session. Owner preview uses a separate authorization path and does not record viewer streams.

## Automated evidence

- Prisma schema validation: passed.
- Lint: passed.
- Targeted managed-video, MP4 constraint, rights/playback and viewer-library checks: **29 tests passed across four files**.
- Final full test run: **71 tests passed across 14 files**.
- Typecheck: passed.
- Production build: passed, including optimized compilation, TypeScript, page data and all 49 generated pages.
- Git whitespace/error check: passed.

Earlier full checks encountered the already-deleted importer. The user requested leaving it unchanged; it subsequently appeared separately in the shared worktree, and was left untouched by this feature work. The separately changed `prebuild` now invokes `db:migrate`; the final build reported that the database was already in sync and made no additional schema change. Neither that prebuild edit nor the importer restoration belongs to this feature's touched-file inventory.

The targeted MP4 tests additionally verify that presigned part requests bind both Content-Length and Content-MD5, and reject malformed/truncated or oversized headers. Database tests use the isolated `ghanaverse_test` schema. Provider behavior is mocked in backend tests; live evidence is separate below.

## Live R2 and browser evidence

The live connection check confirmed write, read, range-read and deletion of a tiny diagnostic object. A read-only bucket lifecycle check confirmed an enabled seven-day incomplete-multipart abortion rule. Browser uploads confirmed the configured localhost CORS policy and exposed ETag acknowledgements.

The owner browser flow created its own temporary title, uploaded the MDN CC0 flower MP4 to R2, decoded it in owner preview, selected its source, self-published, played and sought through the protected viewer, and renewed its source while retaining one analytics session. Owner preview created no viewer stream.

The final 40 MiB episode test retained **16 MiB** already confirmed in R2 and transferred only the remaining **24 MiB**. It passed refresh, a full browser-process restart with restored browser state, wrong-file rejection, duplicate-tab exclusion, offline pause, and recovery from a deliberately expired R2 signature without signing the user out. Episode attachment and decoded preview were confirmed.

The final resumed stage took **35.771 seconds**, approximately **0.67 MiB/s**, including completed-part verification, signing, an expired-signature retry, network transfer and completion validation. The earlier run without injected signature expiry completed the resumed stage in 26.074 seconds, approximately 0.92 MiB/s. The 1,128,375-byte movie's complete UI/API workflow took 23.438 seconds; this is not a raw network-throughput measurement.

Desktop (1440 px) and mobile (390 px) screenshots were inspected. Mobile horizontal-overflow checks passed, keyboard tab navigation is implemented, and the run recorded zero browser JavaScript errors. Final screenshots and the machine-readable `results.json` are under ignored `artifacts/implementation-qa/r2`.

Temporary catalogue records, accounts, rights-holder/company fixtures, upload sessions and stored R2 objects were removed. The final storage command reported **0 stored, 0 reserved, 0 pending cleanup, and 8,000,000,000 bytes available**.

## Remaining release checks

Production environment variables, exact production CORS origins, production migration/deployment and a live production check remain outstanding. No transcoding, adaptive HLS, media custom domain, Worker or cleanup scheduler is provisioned; run the documented cleanup command periodically in the hosting environment.

The desktop browser checks establish local behavior with the configured R2 bucket. They do not establish every browser/device combination or multi-gigabyte throughput. The 40 MiB padded MP4 fixture exercises three multipart parts without consuming gigabytes of the storage allowance.

See [setup and operations](R2_VIDEO_SETUP.md) and [local CORS policy](r2-cors.local.json).

## Touched files

Paths are relative to the application folder containing package.json.

- `.env.example`
- `app/(player)/watch/[id]/page.tsx`
- `app/(viewer)/creator/content/[id]/page.tsx`
- `app/(viewer)/creator/content/[id]/preview/page.tsx`
- `app/(viewer)/creator/content/layout.tsx`
- `app/(viewer)/creator/content/page.tsx`
- `app/admin/content/[id]/preview/page.tsx`
- `app/admin/storage/page.tsx`
- `app/api/admin/storage/cleanup/route.ts`
- `app/api/admin/storage/diagnostics/route.ts`
- `app/api/admin/storage/route.ts`
- `app/api/creator/content/[...path]/route.ts`
- `app/api/creator/content/route.ts`
- `app/api/creator/episodes/[id]/route.ts`
- `app/api/creator/options/route.ts`
- `app/api/creator/seasons/[...path]/route.ts`
- `app/api/creator/video-assets/[id]/route.ts`
- `app/api/playback/assets/[id]/source/route.ts`
- `app/api/uploads/route.ts`
- `app/api/video-assets/[id]/selection/route.ts`
- `app/api/video-uploads/[id]/complete/route.ts`
- `app/api/video-uploads/[id]/parts/route.ts`
- `app/api/video-uploads/[id]/route.ts`
- `app/api/video-uploads/route.ts`
- `components/admin/content-editor-content.tsx`
- `components/admin/content-scope.tsx`
- `components/admin/creator-library.tsx`
- `components/admin/series-media-content.tsx`
- `components/admin/storage-content.tsx`
- `components/catalogue/home-content.tsx`
- `components/common/FileUpload.tsx`
- `components/dashboard/dashboard-shell.tsx`
- `components/layout/viewer-navigation.tsx`
- `components/player/video-player.tsx`
- `components/providers/providers.tsx`
- `components/uploads/asset-preview.tsx`
- `components/uploads/upload-drawer.tsx`
- `components/uploads/upload-workspace.tsx`
- `components/uploads/video-upload-button.tsx`
- `docs/R2_VIDEO_SETUP.md`
- `docs/R2_VIDEO_VERIFICATION.md`
- `docs/r2-cors.local.json`
- `lib/catalogue.ts`
- `lib/image-policy.ts`
- `lib/platform-error.ts`
- `lib/r2/provider.ts`
- `lib/route-error.ts`
- `lib/series.ts`
- `lib/validation/video.ts`
- `lib/video/browser-upload.ts`
- `lib/video/client-api.ts`
- `lib/video/constants.ts`
- `lib/video/hash.worker.ts`
- `lib/video/inspect-mp4.ts`
- `lib/viewer-data.ts`
- `package.json`
- `pnpm-lock.yaml`
- `prisma/migrations/20261016120000_managed_video/migration.sql`
- `prisma/schema.prisma`
- `README.md`
- `scripts/video-browser-qa.ts`
- `scripts/video-storage.ts`
- `services/admin/content-operations.ts`
- `services/admin/media-operations.ts`
- `services/admin/queries.ts`
- `services/admin/read-models.ts`
- `services/content/access.ts`
- `services/content/creator.ts`
- `services/uploads/uploads.ts`
- `services/video/handler.ts`
- `services/video/playback.ts`
- `services/video/storage.ts`
- `services/video/uploads.ts`
- `services/viewer/playback-operations.ts`
- `tests/managed-video.test.ts`
- `tests/mp4-validation.test.ts`
