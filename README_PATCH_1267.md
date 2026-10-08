# AZOBSS v1267 — Lot Kadaster Map Open Classic Bridge Fix

## Problem diagnosed
The `Buka Peta Pilihan` buttons for Lot Kadaster Berdigit / C3 were bound only inside `azobss-pabm-storefront.js`. The PA/BM page now has classic fallbacks for cart and checkout, so the page can remain usable even if the storefront ES module is delayed or fails. In that state the Lot Kadaster button had no effective click owner and appeared to do nothing.

## Fix
- `azobss-pabm-early-bridge.js` now owns only the Lot Kadaster map-open action plus the existing state picker.
- The map button works independently of the storefront ES module.
- It waits briefly for `azobssOpenLotSelectionMap`; if unavailable it loads a fresh v1267 map script.
- Auth token lookup can use either the storefront bridge or `azobssGetFirebaseAuthHeaders` from Global Auth.
- Prepared NDCDB/NDCDB_C3 selections can still be added through the classic cart API if storefront is unavailable.
- Map/bridge cache versions are bumped to v1267.
- Existing map processing typo `window.window.azobssLongSessionInterval` is corrected with a safe `setInterval` fallback.
- Cart, checkout, payment recovery and server cart-draft logic from v1266 are otherwise unchanged.

Package version: 1.0.1267
