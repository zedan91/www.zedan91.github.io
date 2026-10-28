# AZOBSS Patch 1065 — Navbar Zero Layout Shift

This patch fixes the brief navbar hide/show/reflow seen when moving between pages.

Changes:
- `azobss-global-auth.js` is now the single navbar state owner.
- Duplicate navbar `syncHeader()` work in `azobss-firebase-live-likes-sync.js` is suppressed.
- Cached login / PA-BM state is applied before first paint.
- `PA / BM` and `Ukur Tanah` share the same visual width so adjacent buttons do not jump.
- The public PA link is not reinserted when already correctly positioned.
- v1064 Manual Invoice registered-customer autocomplete remains intact.

Package version: `1.0.1065`
