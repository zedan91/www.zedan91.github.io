# AZOBSS v1024 — 1Tube Movie Artwork Validation + Mana-Mana Radio

- Fixes v1023 Movies cards that could appear as blank entries named `Marvel Studios`, `Universal Pictures`, `Wow Point`, etc. The root cause was recursive traversal of 1Tube/TMDB discovery JSON: nested production-company objects also expose generic `id` + `name`.
- Backend 1Tube normalizer now accepts movie titles only from `title` / `original_title`, and only returns rows that have usable artwork. It no longer treats generic `name` objects as Movies.
- Frontend adds a compatibility guard so polluted rows from an older v1023 Render backend are hidden immediately even before Render is redeployed.
- Adds Mana-Mana Live Radio to the AZOBSSTV Radio tab. Public `/public/channels` rows with `channelType` `radio` / `audio` are normalized as `kind: radio`.
- Adds a 22-station local radio fallback based on the current Mana-Mana public radio catalogue: MANIS FM, SURIA FM, FLY FM, RAKITA FM, HOT FM, IKIMfm, 988 FM, MOLEK FM, EIGHT FM, KOOL FM, NASIONAL FM, TRAXX FM, MINNAL FM, AI FM, RADIO KLASIK, SABAH FM, SABAHV FM, SARAWAK FM, BERNAMA RADIO, WAI FM, ASYIK FM and BEST FM.
- Each fallback radio station has a local SVG artwork card, so Radio is not dependent on remote-logo hotlinking.
- Radio official pages use a full responsive iframe instead of the Live-TV-specific cropped Mana-Mana player viewport.
- TV, Anime, Movies Watch routes, Lot Map, pricing and checkout logic are otherwise unchanged.
- App/cache version: 1.0.1024.

Deployment note: static v1024 already adds the local Radio fallback and hides bad v1023 Movie rows. Redeploy the Render backend from v1024 to enable the live dynamic Mana-Mana Radio catalogue and the strict 1Tube backend movie parser.
