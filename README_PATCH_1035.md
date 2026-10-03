# AZOBSS v1035 — AZOBSSTV Instant Movies First Paint Fix

- Fixes the startup flash where the Movies tab initially showed only the `FREE MOVIES` Live TV channel while the real 1Tube movie catalogue appeared much later.
- Root cause: startup first paint used the tiny `free.m3u` immediately, while `loadMovieCatalog()` tried the live Render/1Tube API for up to 25 seconds before falling back to the bundled movie JSON.
- The bundled `movies-1tube-catalog.json` is now loaded as first-paint data and merged before the first catalog render.
- Live 1Tube metadata still refreshes in the background and replaces the local snapshot when available.
- Rows from the bundled `free.m3u` are explicitly tagged `kind: live`, so the `FREE MOVIES` Live TV channel can no longer leak into the Movies tab merely because its name contains the word `MOVIES`.
- No Render redeploy is required for the startup fix.
- AZOBSSTV cache/app version: 1.0.1035.
