# AZOBSS Patch 1258 — Single Cart Owner / Script Overlap Fix

## Root cause audit
- `/PA-BM/` was loading both `azobss-global-auth.js` and `azobss-firebase-live-likes-sync.js`.
- Those two files are ~75% structurally duplicated and assign 66 of the same `window.*` globals, including `getSavedUser`, `hasSavedLogin`, `azobssRecordPurchase`, purchase-record handlers and auth actions.
- The PA/BM page now loads `azobss-global-auth.js` only. `azobss-firebase-live-likes-sync.js` remains untouched for pages that actually need it, but is not loaded on `/PA-BM/`.
- `azobss-global-auth.js` no longer dynamic-imports another query-version copy of `azobss-pabm-storefront.js`; `/PA-BM/index.html` is the sole storefront loader.
- Storefront `init()` has a hard singleton guard and publishes `window.__AZOBSS_PABM_CART_OWNER__ = "storefront-v1258"`.

## Cart flow
- Restored from the user-confirmed working v1255 path: PA result click -> `window.azobssRecordPurchase` -> `addToStoreCart`.
- No v1257 waiter/stable-owner rewrite is used.
- Cart X is bound directly to rendered cart buttons, avoiding document-level handler collisions.

## Checkout
- Keeps v1256 fresh Firebase token + one 401 retry.
- Keeps secure backend Identity Toolkit fallback in `deploy-server.js` and `backend/server.js`.

## Preserved
- State button-grid + selected highlight.
- Failed/cancelled payment remains in cart; only paid/verified goes to Recent Purchases.
- Existing PA/BM pricing and purchase flow.

Package version: `1.0.1258`
