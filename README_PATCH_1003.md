# AZOBSS Patch v1003 — Replace AnimeNana with 123animehub

Source basis:
- User-supplied 123animehub Deep Inspector report.
- Report crawled 220 pages with
  0 failed pages and
  0 inspector errors.
- Generated AZOBSSTV catalogue: 2524 Anime titles.
- Genres discovered: 43.

What changed:
- Old AnimeNana catalogue is replaced by 123animehub catalogue.
- Existing Anime UI, search, genres, Favorites/Recent and Anime detail layout remain.
- Episode lists are generated lazily from the latest public episode number discovered
  in the report, using 123animehub's public `/anime/<slug>/episode/NNN` route.
- AZOBSSTV no longer tries to iframe the 123animehub page itself.
  The site reports SAMEORIGIN framing protection, so that would fail.
- New backend endpoint:
  `GET /api/azobsstv/anime123/resolve?url=...`
  fetches only an allowlisted public 123animehub episode page, looks for public
  external non-media player/embed URLs exposed in the HTML, and returns one only
  when that external player itself allows framing.
- It does NOT strip/bypass X-Frame-Options or CSP.
- It does NOT relay media, return direct M3U8/MP4/MPD URLs, cookies, auth tokens,
  DRM keys or signed media URLs.
- If no embeddable external player is publicly exposed, Open Source remains the fallback.

Deployment:
- Website + Render backend are both required for v1003.
