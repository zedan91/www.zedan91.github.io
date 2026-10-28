# AZOBSS Patch 1063 — Web Picks moved into More

- Baseline: 1.0.1062.
- Removes `Web Picks` as a direct top-level sticky navigation tab.
- Adds `Web Picks` inside the existing `More` dropdown, immediately after `Mini Web Tools`.
- Keeps the existing `/Web-Pilihan/` URL and all compact English Web Picks page content unchanged.
- Marks the `More` trigger and `Web Picks` dropdown item active while browsing `/Web-Pilihan/`.
- Updates both pre-rendered stickybar markup and the dynamic `azobss-more-nav.js` fallback so the direct tab does not reappear after page load.
- Bumps `azobss-more-nav.js` cache-buster to v1063.
- No backend, payment, Firestore, pricing, PA/BM, Software Tools, CAD, or Sales & Receipts logic changed.
