# AZOBSS Patch 1061 — Web Pilihan

- Baseline: 1.0.1060.
- Adds a new direct top-navbar tab: `Web Pilihan`.
- Adds `/Web-Pilihan/` as a curated directory for useful/interesting third-party websites.
- First entry: SEOStudio Tools (`https://seostudio.tools/`).
- The page is data-driven via `/Web-Pilihan/websites.json` for easy future additions.
- Includes search and category filtering, external-link safety (`noopener noreferrer`), and a third-party disclaimer.
- Shared `azobss-more-nav.js` now ensures the Web Pilihan tab on legacy pages and highlights it when active.
- Static stickybars are pre-rendered with the new tab where possible to avoid first-paint layout shift.
- No backend, payment, Firestore, pricing, PA/BM, Software Tools, CAD, or admin sales logic changed.
