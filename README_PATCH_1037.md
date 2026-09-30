# AZOBSS v1037 — Instant Anime + Radio Artwork Fix

- Anime and Radio cards no longer begin as empty/black artwork while remote image resolvers are sleeping.
- Anime uses a bundled poster when available, otherwise an instant generated artwork card; the real 123AnimeHub poster is then preloaded and swapped in asynchronously when the backend resolver responds.
- Radio-Online.my uses bundled per-station artwork immediately whenever the catalogue has no direct provider logo; the provider logo resolver runs only as a background upgrade.
- The right Channels rail uses the same non-blocking artwork strategy.
- Remote artwork probes time out after 6.5 seconds and never block catalogue rendering.
- Existing Movie persistence, Radio playback, Favorites, Recent, Live TV and EPG behaviour are unchanged.
- Frontend-only fix; Render redeploy is not required.
- App/cache version: 1.0.1037.
