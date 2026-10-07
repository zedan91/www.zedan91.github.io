# AZOBSS Patch 1255 — Restore Proven PA Table Cart Flow

## Diagnosis
The cart path that worked before the Pending Payment work was the v1245 flow:
`PA result click -> azobss-pa-search.js -> window.azobssRecordPurchase -> storefront addToStoreCart`.

v1253/v1254 replaced that proven bubbling flow with a new document-level capture owner. The capture handler called `preventDefault`, `stopPropagation` and `stopImmediatePropagation`, so the original PA result-table handler never got the click. If the capture bridge failed any login/key/storage assumption, the click was swallowed and Troli Anda stayed at 0.

## Fix
- Restored PA/GPS/Syit/BM/SBM/map Add to Cart callers to the proven v1245 call path using `window.azobssRecordPurchase`.
- Restored storefront table capture to the v1245 behavior: it only intercepts a click when the item is already in cart (remove action). A first-time add is allowed to bubble to the PA search handler.
- `azobss-pabm-early-bridge.js` is now STATE-PICKER ONLY. It no longer owns or stops cart clicks.
- State button-grid + selected-state highlight from v1252 remain.
- Payment retention / paid-only purchase list logic from v1250+ remains.
- Global auth remains prevented from overwriting `window.azobssRecordPurchase` on `/PA-BM/`, so that global belongs to the storefront cart on this page.

Package version: `1.0.1255`
