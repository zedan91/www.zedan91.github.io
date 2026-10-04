# AZOBSS Patch 951 — Lot Map Hard Compact / Stale Style Override Fix

- Fixes the right-side Lot Kadaster map panel still showing the old spacing and scrollbar after v950.
- Root cause handled: stale/duplicate `azobssLotSelectionStyles` blocks can cause the earlier `overflow:auto` and larger spacing rules to remain active. v951 removes old style blocks before injecting the current stylesheet.
- Uses a new versioned style id `azobssLotSelectionStylesV951`.
- Desktop dialog receives a runtime `az-lot-compact-v951` class based on the actual browser viewport, so compact mode no longer depends only on `@media (max-height:...)`.
- Compact rules use scoped `!important` declarations, hide the side scrollbar, reduce status/summary/tool/readout/button spacing, and reserve a 300px right panel.
- Adds an extra ultra-compact profile for browser inner height <= 760px.
- Mobile layout remains unchanged.
- Bumps `/assets/js/azobss-lot-selection-map.js` cache query on `/PA-BM/` to `v=951`.
- No backend, pricing, selection, or lot-calculation logic changes.
