# AZOBSS Patch 861 — Forced MP3 Download + Single Play

- `/Sound-Effects/` keeps the 177 built-in sound catalog from patch 860.
- `↓ MP3` no longer navigates directly to a cross-origin MyInstants media URL.
- Added Render endpoint `GET /api/sound-effects/download` in `deploy-server.js`. It only accepts HTTPS `myinstants.com` sound/media URLs, resolves the official MP3 from the sound page when needed, and returns `Content-Disposition: attachment` so the browser downloads the file.
- Download endpoint is rate-limited and rejects non-MyInstants targets.
- Added single-play control for official MyInstants embed iframes. When a different sound iframe becomes active, the previously active iframe is reloaded to stop its unfinished audio, preventing overlapping sounds. Desktop hover plus iframe-focus polling improves detection across browsers/mobile.
- Admin-only Add Sound, search/filter, lazy/infinite scroll, Share and Copy Link remain unchanged.
- Render backend must be redeployed from this baseline for forced download to work.
