# AZOBSS v1023 — 1Tube Movies Provider Replacement

- Replaces the AZOBSSTV Movies provider from 7Movies to 1Tube (`https://www.1tube.org/movies`).
- Inspector evidence showed the 1Tube page is Next.js, renders 281 possible movie cards / 536 images in the captured session, and calls `GET /api/discover/movies?page=1` through page 4.
- Adds backend metadata-only endpoint `GET /api/azobsstv/1tube/movies?pages=4` that fetches 1Tube public discovery JSON and sanitizes it to TMDB id, title, year, rating, artwork and `/watch/{id}` URL. It deliberately ignores media/player/source/manifest fields.
- Frontend prefers the live backend 1Tube catalogue; if the Render backend has not yet been redeployed or the upstream is unavailable, it falls back to a local 1Tube catalogue generated from the existing proven TMDB IDs and the uploaded 1Tube inspector artwork/metadata.
- Movie Hero now identifies `MOVIE • 1TUBE`; `Watch Movie` opens `https://www.1tube.org/watch/{tmdbId}`. The old 7Movies autoplay query is not added to 1Tube URLs.
- Search, Favorites, Recent, native Movies grid and Movie Hero remain unchanged.
- No direct video/manifest extraction, media proxying, DRM/token bypass, login-cookie reuse or X-Frame-Options/CSP bypass is added.
- AZOBSSTV cache/app version advanced to 1.0.1023.

Deployment note: redeploy the Render backend from this package to enable the live 1Tube discovery catalogue. The local fallback catalogue works without backend redeploy.
