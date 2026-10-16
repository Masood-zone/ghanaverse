# Private R2 video setup

Run commands from the folder containing `package.json`. Retain the existing `.env` and database. This feature uses direct browser-to-R2 multipart uploads, a separate FFmpeg video worker for automatic preparation, and authorized one-hour playback URLs. Playback supports MP4 and WebM. Monetization remains deferred.

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

## 4. Start automatic video preparation

Install current FFmpeg and FFprobe executables on the worker machine. Put both on PATH, or configure `FFMPEG_PATH` and `FFPROBE_PATH` with their absolute paths in the worker's private environment. The web host does not need these executables. The worker uses the same `DATABASE_URL` and private R2 configuration as the web app. Apply migrations before running it.

```powershell
pnpm video:worker
```

Keep this process running under your process supervisor or deploy `Dockerfile` as a persistent worker/container. It handles one video at a time, renews its database lease while processing, publishes a heartbeat every 15 seconds, and checks for pending jobs every five seconds. Additional workers claim separate jobs. A stale heartbeat prevents new uploads that require processing, with an offline message. Prepared fast-start H.264/AAC MP4 files can still complete without a worker.

The worker uses a unique temporary directory for each attempt and removes it afterward. `VIDEO_PROCESSING_TEMP_DIR` optionally selects an existing writable directory. Allow disk space for input, prepared output and headroom. Each conversion has a six-hour limit; sources can be up to 24 hours and 8192 pixels per dimension. Restarted workers recover queued jobs and jobs whose ten-minute lease expired. Failed preparation retains the original and supports Retry without re-uploading. Cancellation interrupts processing and removes both objects after the worker releases its lease.

The Docker build copies explicit source folders and does not copy `.env` files. Inject private configuration at runtime. Apply migrations using `pnpm exec prisma migrate deploy` before starting the worker. Use `pnpm video:worker --once` for a bounded one-job run.

## 5. Upload a video

Choose MP4, M4V, MOV, WebM, MKV, AVI, WMV, FLV, MPEG/MPG, TS/MTS/M2TS, 3GP or OGV. The extension is an input filter; FFprobe validates actual contents after upload. Damaged files, encrypted video, playlists, unsupported decoders and audio-only files cannot become playable video.

Normal MP4 files with metadata at the end are accepted. H.264 video with compatible AAC or MP3 audio is remuxed into fast-start MP4 without re-encoding those tracks. VP8, VP9 and AV1 video in supported 8-bit 4:2:0 formats is retained as WebM, with Opus or Vorbis audio. Incompatible WebM audio is converted to Opus. Other decodable codecs (such as HEVC, MPEG-4 Part 2 and ProRes) are converted to H.264/AAC MP4. The first real video track and first audio track are selected; additional audio tracks, subtitles, chapters and file metadata are not imported. Silent video is supported. WebM playback depends on the viewer's browser/device supporting the retained codec.

Compatible tracks are copied without a quality-losing encode. Converted tracks use H.264 CRF 22 / veryfast with two encoder threads, or 160 kb/s audio. FFmpeg and FFprobe run without shell expansion, with file-only input protocols and a bounded set of media demuxers. Only verified prepared objects become playback sources.

Save an unpublished title with recorded rights. In **Video & Trailer**, select **Upload Video** for a movie. For a series, use the specific episode row in **Episodes**. The selected destination appears in the drawer.

The drawer transfers one file at a time using three concurrent 16 MiB parts. It shows confirmed progress separately from bytes in flight. Pause, resume, and retry preserve completed parts. Closed browsers cannot keep uploading. On refresh or restart, sign in, open the workspace, and reselect the original file with its original name and modified date. Completed-part MD5 values are checked against that file before continuing. Browser Web Locks prevent concurrent transfers from tabs on the same origin.

After transfer, the drawer shows **preparing playback** until the worker finishes; you can close the browser during this stage. Refreshing restores processing status. If preparation fails, select **Retry** without reselecting the original. Once ready, preview the video, select **Use this source**, then publish. Uploaded video is disabled until explicitly selected. Replacements retain the managed playback asset ID and require unpublishing. Only one source is enabled per movie/episode. Owner preview does not record viewer streams. Catalogue-only publication remains supported.

Rights holders use `/creator/content`; access is restricted to linked organizations and episodes inherit their series ownership. Ownership transfer, featured placement, premium settings, user administration, and registries remain administrative capabilities.

## 6. Cleanup and recovery

```powershell
pnpm video:storage:status
pnpm video:storage:cleanup
```

Cleanup retries expired/cancelling sessions, removes detached application-owned objects, retries pending deletions, and retries deletion of originals after preparation. Unrelated bucket objects are preserved. Failed cleanup keeps storage counted until provider confirmation. Preparation temporarily needs room for both original and output; replacement also retains the old playable object until cleanup. Output bytes are reserved under the database lock before upload to prevent concurrent jobs exceeding the quota. Originals are deleted only after the prepared asset is committed. Run cleanup periodically and after replacing or deleting media. The worker also runs cleanup once at startup.

Provider calls run outside database transactions. Durable intents and ten-minute operation leases allow a retry after a server crash; a busy response means wait for the operation or its lease to expire. Do not change bucket identity while uploads or stored objects still reference it.

## 7. Production and acceptance

### Vercel production

`vercel.json` declares one `video-worker` daemon in `iad1`, alongside the normal Next.js deployment. Vercel Daemons are in public beta and run only in production. The Vercel project Root Directory must be the repository root. Keep the website Build Command as `pnpm build`; the daemon is built separately from `Dockerfile` and receives the production environment variables. FFmpeg and FFprobe are installed in the image. Keep their optional path overrides unset on Vercel, and use `/tmp` for `VIDEO_PROCESSING_TEMP_DIR` if set.

The container invokes the installed Prisma CLI directly to apply committed migrations before starting the worker through Node and `tsx`; a migration failure prevents it from starting. It retains development dependencies because the worker executes TypeScript through `tsx` and uses the Prisma migration CLI. `.dockerignore` excludes private environment files and local build/QA data from the container build context.

Push the reviewed commit to the linked production branch, then confirm the production deployment is ready and its logs show `Video worker ready`. Retry a small upload, preview it, and check seeking before larger uploads. Ensure the container has enough temporary disk for both source and output. Monitor daemon CPU usage, memory and disk; the 8 GB application bucket quota does not guarantee equivalent worker disk capacity. Production deployments restart the daemon, and interrupted jobs can be retried.

References: [Vercel Daemons](https://vercel.com/docs/daemons), [configuration](https://vercel.com/docs/daemons/config-reference), [limits and quotas](https://vercel.com/docs/daemons/limits).

Add the same five private variables to the production web and worker environment settings, apply migrations once, redeploy both, and run the connection check there. Confirm the worker logs its ready message before testing broader-format uploads. Add the production origin to bucket CORS. Never prefix R2 credentials with `NEXT_PUBLIC_`. Run the worker separately from HTTP request handlers; conversions are durable background jobs.

Live acceptance requires a small valid video followed by a controlled large-file recovery test within the available quota. Check movie/episode attachment, source preview and selection, publishing, range seeking, source expiry recovery, Kids restrictions, and analytics continuity. Test interruption, offline mode, expired signatures, wrong-file selection, a second tab, quota exhaustion, cancellation, and cleanup failure. Record actual throughput and recovered bytes; unit tests and a successful connection check do not establish those results.

The 8 GB application limit counts this application's objects and reservations. It cannot account for unrelated bucket objects or other R2 resources in the Cloudflare account and is not a billing guarantee. Check current account usage in Cloudflare.

References: [R2 uploads](https://developers.cloudflare.com/r2/objects/upload-objects/), [S3 API compatibility](https://developers.cloudflare.com/r2/api/s3/api/), [CORS](https://developers.cloudflare.com/r2/buckets/cors/), [S3 credentials](https://developers.cloudflare.com/r2/get-started/s3/), [presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/).
