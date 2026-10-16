# Private R2 video setup

Run commands from the folder containing `package.json`. Retain the existing `.env` and database. This feature uses prepared H.264/AAC MP4 files, direct browser-to-R2 multipart uploads, and authorized one-hour playback URLs. Monetization and automatic transcoding are deferred.

## 1. Create the bucket

In Cloudflare, open **R2 Object Storage → Overview → Create bucket**. Choose a dedicated name (for example `ghanaverse-videos`) and **Standard** storage. Keep the public development URL disabled and do not enable a public custom domain.

Open **Manage R2 API Tokens → Create API token**, choose **Object Read & Write**, and limit access to this specific bucket. Copy its Access Key ID, Secret Access Key, and S3 endpoint into local private configuration. Do not paste credentials into chat or commit them.

```dotenv
R2_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
R2_BUCKET_NAME=<BUCKET_NAME>
R2_ACCESS_KEY_ID=<ACCESS_KEY_ID>
R2_SECRET_ACCESS_KEY=<SECRET_ACCESS_KEY>
R2_STORAGE_BUDGET_BYTES=8000000000
```

Use the endpoint displayed by Cloudflare for jurisdiction-specific buckets. Variables remain server-only. Restart the application after changing them.

## 2. Configure CORS and lifecycle

Open the bucket's **Settings → CORS policy** and paste the contents of `docs/r2-cors.local.json`. Add the exact production origin to `AllowedOrigins` before deployment, such as `https://your-application.example`, without a trailing slash. Include each preview origin only if you intend to permit uploads from it. Do not use `*` for origins.

The browser needs `PUT` for parts, `GET`/`HEAD` for playback, `Content-MD5` for integrity, and exposed `ETag` for acknowledgements. Signed `Content-Length` binds each part to its reserved length; the browser supplies that header. Application API requests continue to use same-origin authentication.

Under **Object lifecycle rules**, confirm that incomplete multipart uploads are aborted after **7 days**. Do not add a rule that deletes completed catalogue videos.

## 3. Apply the additive migration

```powershell
pnpm install
pnpm db:generate
pnpm exec prisma migrate deploy
pnpm video:storage:check
pnpm dev
```

The migration adds session, part, reservation, and object records; existing catalogue entries and link sources are retained. Do not reset the database.

The connection check writes, reads, range-reads, and deletes a tiny temporary diagnostic object. It does not prove browser CORS. `/admin/storage` also provides this check and displays safe configuration status and stored/reserved/pending-cleanup/available totals.

## 4. Prepare and upload a video

Prepare an MP4 containing one H.264 video track and optional AAC-LC audio. Place MP4 metadata before video data (fast start). Fragmented MP4, unsupported codecs, invalid files, and headers larger than 8 MiB are rejected. If FFmpeg is available:

```powershell
ffmpeg -i input-video.ext -c:v libx264 -pix_fmt yuv420p -c:a aac -movflags +faststart prepared.mp4
```

Save an unpublished title with recorded rights. In **Video & Trailer**, select **Upload Video** for a movie. For a series, use the specific episode row in **Episodes**. The selected destination appears in the drawer.

The drawer transfers one file at a time using three concurrent 16 MiB parts. It shows confirmed progress separately from bytes in flight. Pause, resume, and retry preserve completed parts. Closed browsers cannot keep uploading. On refresh or restart, sign in, open the workspace, and reselect the original file with its original name and modified date. Completed-part MD5 values are checked against that file before continuing. Browser Web Locks prevent concurrent transfers from tabs on the same origin.

After completion, preview the video, select **Use this source**, then publish. Uploaded video is disabled until explicitly selected. Replacements retain the managed playback asset ID and require unpublishing. Only one source is enabled per movie/episode. Owner preview does not record viewer streams. Catalogue-only publication remains supported.

Rights holders use `/creator/content`; access is restricted to linked organizations and episodes inherit their series ownership. Ownership transfer, featured placement, premium settings, user administration, and registries remain administrative capabilities.

## 5. Cleanup and recovery

```powershell
pnpm video:storage:status
pnpm video:storage:cleanup
```

Cleanup retries expired/cancelling sessions, removes detached application-owned objects, and retries pending deletions. It only touches keys recorded by this application; unrelated bucket objects are preserved. Failed cleanup keeps the reservation/object counted until provider confirmation. Replacement temporarily requires room for both the old and new objects. Run cleanup after replacing or deleting media and periodically in the production environment; this release does not provision a scheduler.

Provider calls run outside database transactions. Durable intents and ten-minute operation leases allow a retry after a server crash; a busy response means wait for the operation or its lease to expire. Do not change bucket identity while uploads or stored objects still reference it.

## 6. Production and acceptance

Add the same five private variables to the production host's environment settings, apply the migration once, redeploy, and run the connection check there. Add the production origin to bucket CORS. Never prefix R2 credentials with `NEXT_PUBLIC_`.

Live acceptance requires a small valid video followed by a controlled large-file recovery test within the available quota. Check movie/episode attachment, source preview and selection, publishing, range seeking, source expiry recovery, Kids restrictions, and analytics continuity. Test interruption, offline mode, expired signatures, wrong-file selection, a second tab, quota exhaustion, cancellation, and cleanup failure. Record actual throughput and recovered bytes; unit tests and a successful connection check do not establish those results.

The 8 GB application limit counts this application's objects and reservations. It cannot account for unrelated bucket objects or other R2 resources in the Cloudflare account and is not a billing guarantee. Check current account usage in Cloudflare.

References: [R2 uploads](https://developers.cloudflare.com/r2/objects/upload-objects/), [S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/), [S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
