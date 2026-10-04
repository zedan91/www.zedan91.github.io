# AZOBSS Patch 950 — Lot Map Compact Side Panel

- Desktop Lot Kadaster map side panel is compacted so the whole right panel fits in normal laptop/desktop viewport heights without an inner scrollbar.
- Reduced vertical padding, row heights, button heights and note typography only for desktop viewports up to 920px tall.
- Added a stronger compact profile for viewports up to 780px tall.
- Map side panel uses `overflow:hidden` in the compact desktop profile after fitting content.
- Mobile layout remains unchanged.
- Bumped `azobss-lot-selection-map.js` cache query to `v=950` on `/PA-BM/`.
- No backend, price, selection or lot-calculation logic changes.
