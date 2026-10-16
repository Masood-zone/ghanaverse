# Video format support verification

Verified locally on 2026-10-16. This report distinguishes local validation from live deployment.

## Delivered behavior

- Source uploads accept MP4/M4V, MOV, WebM, MKV, AVI, WMV, FLV, MPEG/MPG, TS/MTS/M2TS, 3GP and OGV.
- Prepared MP4s retain the existing immediate-completion path. Other inputs enter a durable PostgreSQL processing queue, with FFprobe validation and FFmpeg preparation on a separate worker.
- Ordinary MP4s with end-of-file metadata are remuxed automatically. Compatible H.264/AAC/MP3 tracks are copied; VP8/VP9/AV1 with compatible Opus/Vorbis audio becomes WebM. Other decodable video/audio is converted when needed.
- Processing survives browser closure. The drawer restores status after refresh and supports retry without re-uploading, cancellation, and ready-source refresh.
- Source and prepared bytes remain counted until deletion is confirmed. Failed processing retains the original. Failed source cleanup remains reserved and can be retried. Only prepared, verified objects are attached to playback assets.
- A worker heartbeat prevents broader-format uploads from being silently queued when the processor is offline. Existing authentication, ownership, media-rights, source-selection and publication gates still apply.

## Real file and browser checks

The supplied `SDK Dele - African Beatings (Parody Video) ft Clemento Suarez.mp4` is a 92,920,710-byte, 1920×1080, approximately 166-second H.264/AAC file whose metadata is at the end. The previous bounded fast-start inspection rejected that layout.

Real FFmpeg/FFprobe preparation produced a 92,920,658-byte MP4 by copying the existing video and audio tracks. The original SHA-256 digest matched before and after. The result loaded, played, and sought to approximately 83.01 seconds in headless Microsoft Edge over a local HTTP server supporting byte ranges.

A generated VP9/Opus WebM retained its codecs and WebM container, then played and sought in Edge. A generated MKV containing MPEG-4 Part 2 video and AC3 audio was converted to MP4, then played and sought in Edge. All three original inputs passed through the actual browser upload queue code with the new processing path. The server response in that client acceptance check was simulated; it did not upload to R2.

The local evidence is in `artifacts/implementation-qa/video-formats/results.json`; its QA script and media fixtures are ignored by Git.

## Automated validation

- `pnpm db:generate`: passed.
- `pnpm test:prepare`: additive migrations applied to the isolated local `ghanaverse_test` schema.
- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: all 118 tests across 16 files passed.
- `pnpm exec next build`: production build passed. Invoked directly to avoid the repository's prebuild migration command against the configured application database.
- `pnpm db:validate`: passed.
- `git diff --check`: passed.

Managed-video integration tests use the real isolated PostgreSQL database with simulated R2 and media processing. They cover processor availability, MP4 preparation, WebM preservation, failure/retry, output quota enforcement, source cleanup accounting, cancellation, multipart integrity and existing access controls. Actual preparation and browser decoding were checked separately as described above.

## Rollout and remaining checks

The configured application database is remote. These changes have not been applied to that database or deployed. Follow `docs/R2_VIDEO_SETUP.md`: apply the additive migrations, deploy the web release, and run the worker continuously using `pnpm video:worker` with FFmpeg/FFprobe and the same private database/R2 configuration. `Dockerfile.video-worker` supplies a deployable worker image.

Live R2 multipart upload → processing → owner preview → source selection → viewer playback remains to be checked after rollout. Browser testing here covered Edge; retained WebM codecs still depend on the viewing browser/device. Input formats are broad, but corrupted, encrypted, unsupported-decoder and audio-only files are rejected. Processing selects the first video and audio tracks; extra audio tracks and embedded subtitles are not imported. Preparation needs temporary space for the source and output within the shared 8 GB application quota.

## Changed files

- `.env.example`
- `README.md`
- `Dockerfile.video-worker`
- `components/uploads/upload-drawer.tsx`
- `components/uploads/video-upload-button.tsx`
- `docs/R2_VIDEO_SETUP.md`
- `docs/VIDEO_FORMAT_VERIFICATION.md`
- `lib/r2/provider.ts`
- `lib/validation/video.ts`
- `lib/video/browser-upload.ts`
- `lib/video/constants.ts`
- `lib/video/process-media.ts`
- `package.json`
- `pnpm-lock.yaml`
- `prisma/schema.prisma`
- `prisma/migrations/20261016180000_video_processing/migration.sql`
- `prisma/migrations/20261016180100_video_processing_queue_index/migration.sql`
- `scripts/video-worker.ts`
- `services/video/processing.ts`
- `services/video/processor-status.ts`
- `services/video/uploads.ts`
- `tests/managed-video.test.ts`
- `tests/video-processing.test.ts`

Implementation references: [FFmpeg formats](https://ffmpeg.org/ffmpeg-formats.html), [FFprobe](https://www.ffmpeg.org/ffprobe-all.html).
