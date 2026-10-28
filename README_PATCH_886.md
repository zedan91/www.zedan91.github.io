# Patch 886 — Lot Kadaster zero-filter result visibility

- Baseline: 885.
- Fixes PA/BM > Lot Kadaster Berdigit and C3 Carian Umum.
- When a successful Cari Lot result set (for example 5 records) is filtered to `0 daripada 5`, the full-width Carian Umum result card/table no longer disappears.
- The table remains visible and shows `Tiada rekod sepadan dengan Carian Umum.`
- If the original Cari Lot request itself returns zero records, the result table remains hidden as before.
- Bumps `/assets/js/azobss-lot-kadaster-search.js` from `v=11` to `v=12` to avoid stale cache.
- No backend/Render changes.
