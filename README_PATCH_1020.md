# AZOBSS 1020 — AZOBSSTV Native 7Movies Movie Catalogue

- Replaces the single 7Movies portal card with a native AZOBSSTV Movies catalogue.
- Catalogue snapshot is generated from the user-supplied 7Movies homepage inspector JSON (2026-08-21).
- 22 unique `/movie/:id` entries are included from the inspected homepage.
- Movie cards show 7Movies artwork, full title, year, and rating in a responsive 4/3/2/1-column Movies grid.
- Clicking a movie no longer attempts to iframe the 7Movies page. It opens a native AZOBSSTV detail view instead.
- The detail view keeps the user inside AZOBSSTV and provides `Open Source ↗` / `Open Movie Source ↗` links to the canonical 7Movies movie page.
- Search and category filtering work on movie title, year, rating, `Movies`, and `7Movies` metadata.
- Favorites and Recent continue to work with movie entries for signed-in users.
- Movie catalogue is preserved when the Mana-Mana Live TV catalogue refreshes and when the Anime catalogue loads.
- Custom playlist reloads also re-append the local Movies catalogue so Movies do not disappear.
- No 7Movies page framing, direct media extraction, stream URL extraction, media proxying, DRM/token bypass, or CSP/X-Frame-Options bypass is introduced.
- `movies-7movies-catalog.json` is cached locally by the AZOBSSTV service worker.
- AZOBSSTV app/cache/cache-busters updated to v1020 / 1.0.1020.
