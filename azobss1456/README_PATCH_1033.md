# AZOBSS Patch 1033 — Remove Confirmed Unavailable Mini Radio Channels

Package/app version: 1.0.1033
Date: 2026-08-22

## Change
- Global AZOBSS mini radio now removes a station from the visible selector as soon as it is conclusively unavailable: either no Radio Browser stream candidate can be resolved, or every resolved failover candidate fails playback.
- Removed/unavailable stations stay hidden for 7 days in this browser, then are eligible to return automatically in case the provider stream comes back.
- The channel counter now shows only currently available/non-hidden stations instead of the original static catalogue total.
- Random selection also excludes hidden/unavailable stations.
- Search no-result wording changed to `No matching channel - Custom URL`.
- Existing instant-play and multi-source failover behavior from v1032 is retained.
- Global `azobss-radio-player.js` cache-buster bumped from v371 to v372.
- AZOBSSTV/package cache/app version bumped to 1033 for baseline consistency; AZOBSSTV playback behavior is otherwise unchanged from v1032.

## Deployment
Frontend-only change. Render backend redeploy is not required.
