# AZOBSS Patch v1002 — AZOBSSTV Boot Offline/Backend-Failure Fallback Fix

Observed symptom:
- The page stopped at `Playlist failed to load: Failed to fetch`.
- Live TV, Anime and Channels were all empty.

Root cause:
- `loadPlaylist()` fetched the default Render playlist before entering the existing local fallback code.
- If the Render/API request itself threw a network `Failed to fetch` error, execution exited immediately.
- Therefore `./data/free.m3u` and `./data/anime-catalog.json` were never loaded even though both files were already on the website.

Fix v1002:
- Detect the built-in/default playlist before the network fetch.
- A network failure on the default backend playlist is now non-fatal.
- Automatic recovery order:
  1. Try the normal backend playlist.
  2. If unavailable, load local `AZOBSSTV/data/free.m3u`.
  3. Try the dynamic Mana-Mana catalogue; if unavailable, keep the local Live TV list.
  4. Always load the local Anime catalogue independently.
- A custom user M3U URL still reports its own error instead of silently replacing it.
- The page only shows a fatal playlist error if every online and local catalogue is unavailable.
- English-only UI and all v1001 Anime episode behavior are retained.

Deployment:
- Frontend only.
- Render backend does not need to be redeployed for this fix.
