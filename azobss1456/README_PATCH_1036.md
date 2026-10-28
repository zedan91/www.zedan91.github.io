# AZOBSS v1036 — AZOBSSTV Persistent Movies Catalog Race Fix

- Fixes the intermittent Movies-tab state where `No content found.` appeared even though the bundled 1Tube movie catalogue existed.
- Root cause hardened at multiple levels: Movies are now available synchronously from an embedded build-time snapshot before any Live TV or Radio request is awaited.
- Adds a durable in-memory `movieCatalogSnapshot`; Live TV, Radio, Anime and background refreshes cannot permanently remove Movies from `state.channels`.
- `render()`, tab switching and catalog refreshes restore the snapshot automatically if a race leaves zero movie rows.
- Radio fallback no longer blocks the initial Movies render. Radio can arrive later in the background.
- Bundled `movies-1tube-catalog.json` still refreshes the embedded snapshot, and live 1Tube metadata can replace it when valid rows arrive. Empty/failed remote results never replace a working movie catalogue.
- `FREE MOVIES` remains explicitly `kind: live`, so playing that Live TV channel does not affect the native Movies catalogue.
- No Render redeploy is required.
- AZOBSSTV cache/app version: 1.0.1036.
