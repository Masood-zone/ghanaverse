# Architecture and delivery

## References

The implementation follows the local Amanah Welfare System's root-level folder organization, thin pages, client content components, domain service hooks, providers, React Hook Form/Zod forms, reusable dropzone uploads, Axios, and Material Symbols.

The authoritative administrator visuals are `../Designs/Part 3` (A01–A04) and `../Designs/Part 4` (A05–A07), using each screen's `screen.png` and `code.html`. Shared typography and tokens follow `../Designs/Part 1/warm_heritage_stream/DESIGN.md`. GhanaVerse retains its identity. Dashboard business metrics reflect persisted operational data; payment and streaming telemetry are not simulated.

## Folder responsibilities

- `app`: layouts, metadata, page shells, HTTP routes, generated Prisma client.
- `components/admin`: administrator client content components and form sections.
- `components/common`: reusable upload and Material Symbols components.
- `components/dashboard`: responsive authenticated dashboard shell.
- `components/providers`: stable QueryClient and notifications.
- `services/admin`: typed client domain queries, authenticated HTTP orchestration, domain server operations, and read models.
- `services/uploads`: multipart Axios upload and mutation hook.
- `lib`: database/auth infrastructure, Axios/errors, shared validation, image policies, public DTO mapping, and Cloudinary integration.
- `types`: shared API and serialized domain contracts.
- `hooks`, `stores`, `assets`: reserved for actual cross-feature needs. Remote data stays in TanStack Query; form data stays in React Hook Form.
- `prisma`, `tests`, `scripts`, `docs`, `public`: persistence, verification, operational commands, handoff notes, and static assets.

## Data flow and security

Administrator page → client content component → domain TanStack Query hook → Axios → App API route → authorization/input validation → server-only domain operation → Prisma.

Layouts guard entry to the workspace. Every API independently verifies the current user and persisted role/status. Public registration cannot grant administrator access. Suspended users cannot create sessions or access protected operations. Access changes revoke sessions. A transaction lock serializes administrator mutations, protecting the last active administrator and preventing publish/edit races. Mutations and their activity records commit together.

Public catalogue endpoints expose explicit display DTOs rather than raw Prisma records. Private notes, rights-holder contacts, source payloads, and raw playback records are excluded. Viewer playback remains guarded server-side.

## Administrator workflow

Maintain creators, production companies, metadata, and rights holders. Save a title draft; assign credits and artwork; manage trailer, seasons, episodes, and existing playback links; review the private preview; publish; curate collections and featured titles.

Publishing requires title/descriptions, poster, classification, a genre/language, and creator or production attribution. Playback is optional. A published title and its children must be unpublished before editing. Collections retain item order and expose published titles only. Referenced creators/metadata cannot be deleted. Full movie/episode uploads and transcoding remain deferred.

The editor uses one form context across tabs with nested credit fields, dirty-state protection, inline errors, and explicit save/publication outcomes. Artwork uses purpose-validated, authenticated uploads. Uploaded references are stored; removing a reference does not silently delete the provider asset.

## Verification and later work

The administrator operational phase includes users, creators, metadata/rights, content, curation, and activity. Existing viewer functionality and routes are retained through the migration. Broader viewer feature development follows administrator acceptance.

Part 4 subscription, payment, advanced analytics, and royalty screens remain the references for subsequent commercial phases. Their deferred routes are excluded from operational navigation. Material Symbols are served locally, with the upstream license beside the font.


## Existing viewer workflows

Account, profile selection/management, and library pages now use thin authenticated shells and typed Axios/TanStack Query services under `services/viewer`. GET `/api/profiles`, `/api/account`, and `/api/viewer/library` return owned display data. Library responses omit internal notes, rights contacts, source payloads, and playback URLs. Watchlist mutations update the status cache and invalidate library data; playback progress uses the same library key. Public discovery and the authenticated player page retain server rendering.

Profile editing uses React Hook Form/Zod and a native modal dialog with focus handling. Regular playback progress uses Axios; the browser's unload flush uses fetch keepalive for lifecycle delivery.
