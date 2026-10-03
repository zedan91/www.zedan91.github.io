# AZOBSS 1021 — AZOBSSTV Movies Main Player Hero Fix

Baseline: v1020.

## Fix
- Selecting a native Movies card no longer leaves the main player on “Choose a channel to start watching”.
- The selected movie now renders a native hero/detail directly inside the main AZOBSSTV player area using its catalogue artwork, title, year and rating.
- `Open Source ↗` remains an explicit external-source action because 7Movies blocks full-page embedding.
- Movies grid/search stays visible below the player, matching the Live TV browsing flow.
- Favorite is available in the movie hero and the existing Now Playing area remains synchronized.
- Switching away from Movies clears the movie hero and restores the normal player placeholder.
- No third-party iframe bypass, media extraction, proxying, DRM/token bypass or CSP/X-Frame-Options bypass.
- App/cache/cache-busters updated to v1021 / 1.0.1021.
