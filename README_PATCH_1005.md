# AZOBSS Patch v1005 — Anime Posters + Single Episode List + Episode Search

Fixes requested from v1004:

1. Anime posters
- v1004 catalogue inherited `no_poster` placeholders from the crawl output.
- v1005 now uses a backend poster endpoint:
  `GET /api/azobsstv/anime123/poster?slug=<anime-slug>`
- The endpoint only accepts a strict 123animehub slug and tries the public
  `/imgs/poster/<slug>.jpg`, `.png`, then `.webp` paths.
- Returned images are cached for 24 hours.
- If a poster genuinely does not exist, the existing AZOBSSTV fallback icon remains.

2. Remove duplicate Episode List
- The large second `Episode List` below Anime detail has been removed.
- There is now only one episode selector: the existing Episodes panel.

3. Add episode search to the existing Episodes panel
- `Search episode number / title...` is added directly above the episode rows.
- Filtering is live.
- The current episode stays highlighted.
- Clicking an episode still auto-focuses the player area.

Deployment:
- Website + Render backend required because the poster endpoint is new.
