# AZOBSS Patch 985 — AZOBSSTV Home Stickybar Sync

- Removes the standalone AZOBSSTV header containing AZOBSSTV / AZOBSS Home / Refresh / Playlist.
- Adds the same compact fixed Home stickybar used across AZOBSS.
- Uses shared `azobss-home-stickybar-exact-sync.css`, `azobss-global-compact-font-more-nav.css` and `azobss-more-nav.js`.
- AZOBSSTV remains inside the `More` dropdown and the More trigger is active on `/AZOBSSTV/`.
- Home Register/Login and signed-in account controls are enabled through `azobss-global-auth.js`.
- Home search row is intentionally hidden on AZOBSSTV, matching the compact one-row stickybar.
- Existing Refresh / Playlist DOM controls are kept hidden only for JavaScript compatibility; they are no longer visible in the AZOBSSTV header.
- AZOBSSTV player, schedule, Favorites/Recent, channel rail and backend behavior are unchanged.

Package version: `1.0.985`
