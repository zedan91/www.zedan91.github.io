# AZOBSS Patch 867 — Sound Effects Recently Added Updater

- Adds an admin-only `↻ Update Sounds` button to `/Sound-Effects/`.
- The button calls the Render backend with the current Firebase ID token; the backend verifies the admin against the existing AZOBSS server allow-list.
- Backend scans MyInstants `https://www.myinstants.com/en/recent/` (and up to 5 recent pages), stops when an entire page is already known, and skips IDs already present in the 7,210 base catalog or the incremental Firestore catalog.
- New sound pages are resolved server-side to their current official MP3 URL. New records are stored persistently in Firestore collection `soundEffectsRecent` instead of modifying the static 7,210 JSON in the browser.
- Public page loads the 7,210 base catalog immediately, then merges incremental recent records from `GET /api/sound-effects/recent` in the background.
- Adds a `Recent` filter (`Recently Added`). After an admin update adds sounds, the page automatically switches to this filter so the new records are visible immediately.
- Existing compact grid, infinite-scroll-only behavior, single-play audio, forced MP3 download, Share/Copy Link, Anime & Manga fix, and admin-only Add Sound remain intact.
- Render backend redeploy is required for the new updater endpoints.
