# AZOBSS Patch 1272 — Stabilization / Single Runtime Ownership

This build is a stabilization release based on v1271.

- Replaces the 6,471-line legacy combined `azobss-firebase-live-likes-sync.js` runtime on every page with a lean likes/bookmarks-only module. Auth/navbar/purchase records are owned only by `azobss-global-auth.js`.
- Makes PA/BM classic cart core the canonical cart owner; storefront becomes checkout/pricing/enhancement layer and only takes cart ownership as an emergency fallback if the core is absent.
- Keeps Lot Kadaster map click ownership exclusively in the early classic bridge; storefront no longer binds a second map opener.
- Preserves secure checkout fallback and Admin Test Payment while storefront clone binding remains the normal checkout owner.
- Adds complete `npm test` / `npm run verify` scripts so PA/BM regressions are no longer excluded from the default verification flow.
- Updates Firebase Hosting ignore rules so server code, tests, developer files, patch history and audit files are not published as static production assets.
- Package version: 1.0.1272.
- Cleans duplicate HTML IDs in production pages so `getElementById()` / `aria-controls` no longer resolve ambiguously.
