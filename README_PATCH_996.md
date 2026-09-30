# AZOBSS Patch v996 — AZOBSSTV English-Only UI

Scope: `/AZOBSSTV/` frontend only.

- All AZOBSSTV-owned visible UI, status, error, schedule, Anime, Favorites/Recent,
  search/filter and playlist text is English.
- HTML language is `en`.
- Shared stickybar labels are kept English on `/AZOBSSTV/`:
  `Land Survey`, `Build Website`, and English Repair PC submenu descriptions.
- Provider content is preserved as supplied (channel names, programme titles,
  Anime titles and episode titles).
- Backend logic and root package.json are unchanged, so this patch does not
  require a Render backend deployment.
