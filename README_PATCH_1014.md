# AZOBSS 1014 — AZOBSSTV 7Movies External Movies Source

## Scope
- `AZOBSSTV/assets/azobsstv.js`
- `AZOBSSTV/assets/movie-sources/7movies-card.svg`
- `AZOBSSTV/index.html`
- `AZOBSSTV/sw.js`
- `AZOBSSTV/data/free.m3u` version comment
- `package.json`

## Change
- Added **7Movies** (`https://7movies.in/`) as a built-in source under the **Movies** tab.
- The Movies source is available immediately at first paint and survives Mana-Mana Live TV catalogue refreshes and Anime catalogue refreshes.
- 7Movies uses stable local SVG artwork rather than a third-party hotlinked logo.
- Clicking the 7Movies card opens the public source in a new browser tab so AZOBSSTV remains open.
- The card is labelled `External movie source`.

## Safety / playback boundary
- No direct stream URLs are scraped, extracted, proxied or stored.
- No DRM, token, CSP, `X-Frame-Options`, paywall or player restrictions are bypassed.
- No 7Movies iframe is forced into AZOBSSTV.

## Version
- Package/app/cache version: `1.0.1014` / `1014`.
