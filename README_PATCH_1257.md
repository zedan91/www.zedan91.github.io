# AZOBSS Patch 1257 — Stable Add-to-Cart Ownership Fix

## Root causes fixed
1. **Cart owner key could change while the page was open.** Older patches could write an item under a username key and later render from a Firebase UID key, or vice versa. v1257 uses the normalized AZOBSS username as the canonical cart owner and recovers an older UID-key cart when needed.
2. **Two legacy purchase-history scripts still expose `window.azobssRecordPurchase`.** v1257 introduces a dedicated `window.azobssAddToPaBmCart` API and all PA/BM search modules prefer it. Global Auth and Live Likes are also blocked from owning the old global anywhere under `/PA-BM/` using pathname detection.
3. **Direct Add-to-Cart login guard disagreed with the cart login check.** The guard required `auth.currentUser` even when the navbar/saved AZOBSS session was already logged in. It now accepts the same saved AZOBSS session as `requireLogin`.

## Preserved
- v1256 fresh checkout-token retry / backend token verification fallback.
- v1256 immediate `×` cart removal.
- v1252 button-grid state highlight.
- v1250 cancelled/failed payment remains in cart and unpaid rows stay out of Recent Purchases.

Package version: `1.0.1257`
