# AZOBSS Patch 1028 — Radio-Online.my Radio Catalogue Replacement

- Replaces the built-in AZOBSSTV Radio source from Mana-Mana Radio with `https://radio-online.my/`.
- The user-supplied Radio-Online.my inspector snapshot reported 236 discovered entries across 10 scanned pages. v1028 filters non-station/legal/category/state/city pages and keeps 191 station pages as the local fallback catalogue.
- 136 station rows in the supplied snapshot already contain a direct Radio-Online.my station artwork URL. The remaining rows use the backend station-logo resolver first, with a per-station local artwork fallback so cards never collapse to a blank image.
- Adds metadata-only backend endpoint `GET /api/azobsstv/radio-online/radios`, backed by Radio-Online.my's public country radio metadata endpoint. It returns station name, slug, logo, frequency/rating when available, and the public station page URL only.
- Adds `GET /api/azobsstv/radio-online/logo?slug=...` to resolve the visible station artwork from the public station page when the catalogue metadata lacks a usable logo. It redirects to the provider image; it does not proxy or expose audio streams.
- Mana-Mana remains the Live TV provider only. Radio rows returned by Mana-Mana are ignored by the AZOBSSTV frontend.
- Native AZOBSSTV Radio UI from v1026/v1027 is retained. The provider station page is used as the hidden official radio source; the full external website is not shown in the main player.
- Radio card subline now shows station frequency when available, otherwise `Radio Online Malaysia`.
- Radio Today's Schedule remains removed.
- Live TV, Movies, Anime, Favorites and Recent are unchanged.
- Local fallback file: `AZOBSSTV/data/radio-online-my-catalog.json`.
- App/cache/package version: 1.0.1028.
- Render backend redeploy is recommended for the live Radio-Online.my catalogue and real-logo resolver. The 191-station local fallback still loads without redeploy.
