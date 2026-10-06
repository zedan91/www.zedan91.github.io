# AZOBSS Patch 1031 — AZOBSSTV Clear Search on Tab Change

Package/app version: 1.0.1031
Date: 2026-08-22

## Change
- AZOBSSTV now clears the shared Search field automatically whenever the user changes tabs between Live TV, Movies, Anime, Radio, Favorites, and Recent.
- Example: searching `dragon ball` in Anime and then opening Movies now resets the Search box to blank before the Movies catalogue renders, so the Anime query no longer filters the next tab.
- Clicking the already-active tab does not unnecessarily clear the current search; clearing occurs only on an actual tab change.
- Category/group selector behavior is unchanged.
- No changes to playback, Movies, Anime providers, Radio audio, Favorites, Recent, or backend APIs.
- Frontend cache/service-worker/app telemetry version bumped to 1031.

## Deployment
Frontend-only change. Render backend redeploy is not required.
