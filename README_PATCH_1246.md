# AZOBSS Patch 1246 — Pending Payment Re-cart + Remove Fix

## Fixed
- `Senarai Pembelian Terkini` Pending Payment now has a visible **↩ Re-cart** button.
- Re-cart survives closing/cancelling the ToyyibPay tab or even reopening the browser because the pending order is recovered from the authenticated backend, not from browser-only cart state.
- Re-cart restores the complete original pending order into **Troli Anda** and `Teruskan Pembayaran` resumes the same ToyyibPay bill instead of creating a mismatched duplicate.
- This also preserves Lot Kadaster pending payments safely: the original verified pending order is resumed rather than trying to recreate a stale/missing lot selection token.
- The red cart-× remove button now works for normal users through a protected backend action. Firestore production rules intentionally allow `purchaseLogs` update/delete only for Admin, so the old direct browser `deleteDoc()` path could not remove the user's pending row.
- Backend removal verifies Firebase login, record ownership, and unpaid status before deleting only the pending purchase row. Paid/verified records cannot be removed by this action.
- Embedded legacy `users.purchaseRecords` copies are cleaned at the same time when present.
- If an old ToyyibPay bill is paid later after its pending row was removed, the existing payment callback can recreate/update the paid purchase record normally.
- PA/BM cache versions bumped to `azobss-global-auth.js?v=1246` and `azobss-pabm-storefront.js?v=1246`.

Package version: `1.0.1246`
