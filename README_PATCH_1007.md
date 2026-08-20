# AZOBSS Patch v1007 — Instant Local-First Boot + Background Sync

Problem:
- AZOBSSTV could remain on `Loading AZOBSSTV...` for a long time even though
  it eventually loaded successfully.
- Startup was sequential:
  1. wait for Render `/config`,
  2. wait for Device Ping,
  3. wait for remote playlist/API,
  4. only then try the local fallback.
- A sleeping/free Render instance could therefore block first paint for tens
  of seconds.

Fix:
- Local-first startup.
- The tiny bundled `data/free.m3u` is loaded and rendered first.
- Live TV appears immediately without waiting for Render.
- Static local files now use `force-cache` so the browser/service worker can
  reuse them instead of `cache: no-store`.
- The larger Anime catalogue loads in parallel and is merged after Live TV
  is already visible.
- Render `/config`, Mana-Mana refresh, Device Ping, EPG and notifications run
  in the background.
- Mana-Mana automatically replaces the bundled Live TV list when its fresh
  response arrives.
- Render cold-start can no longer keep the main UI stuck at Loading.
- A custom playlist also loads in the background while the local catalogue
  remains usable.
- Background refresh avoids destroying an Anime detail page if the user has
  already opened one.

Deployment:
- Frontend only.
- Render backend does NOT need to be redeployed.
