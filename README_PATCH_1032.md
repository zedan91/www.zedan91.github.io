# AZOBSS Patch 1032 — Mini Radio Instant Select + Multi-Source Failover

Package/app version: 1.0.1032
Date: 2026-08-22

## Change
- Global AZOBSS mini radio no longer requires selecting a station and then pressing Play as a second step. Changing the station now immediately stops the previous station and starts the newly selected station.
- The Play button remains as a browser-autoplay fallback / manual retry.
- Radio Browser resolving now keeps multiple ranked candidate streams instead of trusting only one top result.
- Playback waits for the real `playing` event with a 6-second health timeout. If a candidate is dead, silent, unreachable, or stalls before playback, the player automatically tries the next candidate (up to five ranked sources).
- A stale cached stream is cleared when it fails and the resolver falls back to fresh candidates.
- A station is marked temporarily unavailable only after all resolved candidates fail, reducing false failures caused by one stale directory URL.
- Mini player guidance text now states that selecting a station immediately attempts playback.
- Global `azobss-radio-player.js` cache-buster bumped from v370 to v371.
- AZOBSSTV/package cache/app version bumped to 1032 for baseline consistency; AZOBSSTV Radio tab behavior is otherwise unchanged from v1031.

## Deployment
Frontend-only change. Render backend redeploy is not required.
