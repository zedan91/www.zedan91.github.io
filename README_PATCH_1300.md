# AZOBSS v1300 — Render Runtime Startup Fix

Date: 2026-10-12
Package: 1.0.1300
Baseline: v1299

## Root cause
Render crashed at startup with `ReferenceError: app is not defined` because v1299 accidentally inserted an Express-style `app.post('/api/shopee-affiliate/product-metadata', ...)` block into `deploy-server.js`. This runtime uses its own `handler(req, res)` router and does not define an Express `app`.

## Fix
- Removed the stray Express `app.post(...)` block from `deploy-server.js`.
- Preserved the existing `/api/shopee-affiliate/product-metadata` route inside the native runtime handler.
- Preserved the v1299 backend-first Shopee resolver, canonical URL / shopId / itemId recovery, and Chromium fallback.
- Runtime diagnostic patch and administrator version badge bumped to v1300.
