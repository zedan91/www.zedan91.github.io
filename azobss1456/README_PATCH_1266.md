# AZOBSS v1266 — Full Browser Restart Cart Persistence Hard Fix

## Diagnosis confirmed in v1265

The remaining bug was not one single storage issue. Four concrete gaps were present:

1. **Classic Add-to-Cart did not own server sync.** The visible cart can work before `azobss-pabm-storefront.js` is ready, but v1265 only mirrored cart writes to the server from that optional ES module. In Incognito/private browsing, closing the whole browser erases localStorage, so an unsynced cart disappears.
2. **A server cart saved before checkout could not be restored.** `payment-recovery` returned the items, but the frontend required `orderId` or `billCode`, which a normal pre-checkout cart does not have.
3. **Reusable ToyyibPay pending bills skipped the cart-draft write.** The early `reusableOrder` return happened before `azPersistPaBmCartDraft()`.
4. **Auth-ready recovery was placed after `await recordLoginHistory()`.** A slow/failed Firestore history write could stop the restart recovery path before it ran.

## v1266 changes

- `azobss-global-auth.js` now mirrors every classic cart update to `/api/pa-bm/cart-draft` using the real Firebase ID token. It queues writes that happen before Firebase auth hydration and flushes them after login is ready.
- Server draft recovery now restores **cart-only** snapshots with no payment order ID.
- Reused pending ToyyibPay orders refresh the durable cart draft before redirect.
- Restart recovery starts immediately from Firebase UID and is flushed immediately after `saveUser(fullUser)`, before login-history/analytics work.
- Cart drafts use **Firestore + local backend JSON fallback** (`pa-bm-cart-drafts.json`) so a temporary Firebase Admin/Firestore failure does not make browser-restart recovery depend on client storage.
- Existing Add-to-Cart core and storefront cart behavior are intentionally unchanged.

## Expected flow

1. Add PA/BM/etc. to Troli Anda.
2. Close the **entire browser**, including Incognito/private windows.
3. Reopen and log in with the same AZOBSS account.
4. Open `/PA-BM/`.
5. The authenticated server draft restores the cart even if browser localStorage was erased.

For pending ToyyibPay payments, the same unresolved bill can still be resumed when valid. Paid/verified payments clear the server draft.
