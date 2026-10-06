# AZOBSS 1019 — AZOBSSTV 7Movies In-Page Movies Portal

- Changes the built-in 7Movies Movies source from `webOnly`/new-tab navigation to an in-page `portal` mode.
- Clicking 7Movies now loads `https://7movies.in/` inside the AZOBSSTV main player area, visually consistent with the Live TV experience.
- Portal mode uses a full responsive iframe instead of the Mana-Mana Live TV crop/zoom logic.
- An **Open in new tab ↗** fallback remains visible in the player. If the provider enforces `X-Frame-Options` or CSP `frame-ancestors`, AZOBSSTV does not bypass it.
- No direct media URL extraction, proxying, DRM/token bypass, or CSP/X-Frame-Options bypass is introduced.
- Live TV, Anime, Lot Map, pricing and JUPEM backend behavior are unchanged.
- AZOBSSTV cache-busters updated to v1019.
