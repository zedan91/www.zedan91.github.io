# AZOBSS Patch 1259 — Classic Cart Core / Module-Independent Add-to-Cart Fix

## Root cause confirmed from the live symptom
The PA search UI can be fully interactive while `window.azobssRecordPurchase` is still undefined. That proves Add to Cart was still depending on `azobss-pabm-storefront.js`, an ES module whose Firebase/import chain may be delayed, blocked, stale, or partially deployed. The visible error `Cart is not ready. Refresh the page and try again.` is emitted by `azobss-pa-search.js` before any cart write occurs.

## Fix
- Adds a classic cart core and embeds it directly inside `PA-BM/index.html` before Firebase/global-auth modules, so Add to Cart does not depend on any ES-module/CDN/asset load succeeding. The same source is also kept at `assets/js/azobss-pabm-cart-core.js` for maintenance.
- Publishes `window.azobssAddToPaBmCart` and `window.azobssRecordPurchase` immediately, so PA/BM cart writes do not depend on Firebase module readiness.
- Writes the same `azobss_pabm_store_cart_v1_*` format used by storefront.
- Mirrors cart data across known UID/username keys to prevent auth-hydration key drift.
- Renders count/items/total immediately and supports direct remove.
- `azobss-pa-search.js` now prefers the dedicated `window.azobssAddToPaBmCart` API.
- If the full storefront module later loads, it upgrades the same API and continues with price-adjustment/payment logic.
- Keeps v1258 script-overlap removal, v1256 checkout-token retry/backend verifier, v1252 state highlight, and v1250 failed/cancelled payment retention.

Package version: `1.0.1259`
