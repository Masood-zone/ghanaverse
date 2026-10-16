# Accounts, viewer profiles, and episodic series

Run commands from the application directory containing `package.json`.

## Create an episodic series

1. Open **Administration → Content**, create a title, choose **Series**, and save its metadata.
2. Under **Series & Episodic Management**, add a season, then add its episodes. Suggested numbers follow the highest existing number; numbers remain editable.
3. On an episode, choose **Add playback** or **Manage playback**. The media form selects that episode. Supply a supported source, record its rights and duration, and enable playback.
4. Review each episode's playback status. An episode without an enabled, supported source appears unavailable to viewers.
5. Publish the parent series when its metadata is ready. A catalogue-only series can be published without playable episodes. Unpublish before editing a live title, its seasons, or its media.

Seasons and episodes are ordered numerically, including across season boundaries. Numbering gaps do not create extra episodes. Previous, Next, resume actions, and autoplay share the same ordering service. An unavailable adjacent episode stops progression; viewers can explicitly choose a later episode from the season browser. Episodes inherit the parent series' classification and publication state.

## Accounts and profiles

- **Account** edits the owner's name and photo and contains the existing password controls. Email stays read-only.
- **Profiles → Manage Profiles** edits a viewer's name, preset avatar or independent photo, Kids mode, and playback preferences. Up to five profiles are supported.
- Each profile owns its list, history, episode/movie resume positions, recommendations, and preferences. A new profile starts with empty viewing data.
- Kids mode includes published U and PG titles. Higher and missing classifications are excluded from discovery and blocked at protected playback/API boundaries. Incompatible saved entries remain stored so they return when the profile becomes unrestricted.
- Profile switching is unrestricted. Kids mode is a filtered experience and has no parental PIN lock.
- The active profile is remembered for the browser. Switching refreshes other tabs and stops their previous player. Profile-sensitive client requests include the expected profile ID so stale requests can be rejected.

Photos accept decoded JPEG, PNG, or WebP images up to 8 MB. The server processes photo images and uploads them through Cloudinary. Account/profile saves accept an owned upload identifier, with purpose validation. Removing a photo restores the avatar/initial fallback.

## Authentication and playback

Successful registration establishes a session, preserves the original local callback, and displays a welcome toast once. The server's `/auth/continue` page validates the session and opens the profile picker when multiple profiles exist, before continuing to that callback. Sign-in no longer performs its own extra session and profile API requests. Sign-out cancels viewer queries, clears client data, and opens Home with a fresh request. Better Auth synchronizes logout with other tabs; their domain caches are cleared and protected pages return to sign-in. Failed logout leaves the account usable and allows a retry. Protected pages and APIs check access directly without an auth proxy.

The first video starts manually. **Autoplay next episode** defaults off. When enabled, completion must be saved before a cancellable ten-second countdown starts. The immediate next episode must be available. Automatic playback blocked by the browser leaves manual Play available.

**Prefer subtitles when available** applies to available native text tracks and requests captions from YouTube. When off, YouTube retains its own defaults and CC controls. Subtitle files and caption availability remain the content/provider's responsibility; this feature does not create subtitle tracks.

## My List and Home

Card bookmarks toggle the active profile's saved state without opening the title. Pending writes show a spinner and disable duplicate actions. Repeated cards and the title page share a profile-scoped saved-ID query.

The Home hero uses eligible featured titles, with recent eligible titles as fallback. Preview buttons, arrows, swipe, keyboard navigation, and rotation controls select slides. Rotation pauses for focus, hover, open trailers, hidden tabs, and reduced-motion preferences. Browse retains its search/filter layout.

Use **Publishing → Feature this title in the catalogue** on several eligible titles to populate the featured previews. A single eligible title displays without duplicate slides or unnecessary carousel controls.
