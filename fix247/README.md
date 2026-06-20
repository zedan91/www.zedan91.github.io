AZOBSS Mini Tools Compact Card Restore Fix (235)

- Keeps Mini Web Tools premium background and controls.
- Restores compact cards: icon, title and type only.
- Hides long descriptions, feature chips, badges and Open tool row from card list.
- No Firebase Rules or Render ENV changes required.

## Patch 243 - Admin Dashboard Query Warning Fix

Scope: Admin dashboard only.

Changes:
- Added visible Admin Dashboard query warning panel when Firestore query/count fails.
- Dashboard no longer silently looks like 0/empty data when actual issue is permission denied, missing index, unauthenticated session, or Firestore availability.
- Added labels for main admin queries: Overview, Registered Users, Activity, Online Users, Support, Notifications, Payments, Commissions, Settings.

Skipped / not touched:
- Cart, Like, Bell, Message badge.
- My Purchases.
- PA/BM paid/verified download flow and logic.

Firebase Rules:
- No new rules required by this patch.
- If warning says permission denied, publish the rules from previous admin email sync patch.

## AZOBSS Patch 245 - Admin Key ENV Sync + Admin Dashboard Key Helper

- `deploy-server.js` now treats `ADMIN_KEY` as a valid fallback for `AZOBSS_ADMIN_API_SECRET`, because Render startCommand uses `node deploy-server.js`.
- Admin Dashboard backend fetch now sends `x-admin-key` from browser storage key `azobssAdminApiKey`.
- Admin Dashboard Settings now has a Backend Admin Key helper to save/clear the key without opening DevTools console.
- Priority 2 skipped areas remain untouched: Cart/Like/Bell/Message badge, My Purchases, and PA/BM paid/verified download flow.


## Patch 246 - Deploy Server Admin Secret Strict Fix

Admin backend routes in `deploy-server.js` now require the configured `ADMIN_KEY` / admin API secret. Firebase profile role alone is no longer enough for deploy-server admin backend actions. This prevents a user-editable role/profile from being used to pass backend admin routes.

Not touched: Cart/Like/Bell/Message badge, My Purchases, and PA/BM paid/verified user download flow.


## Patch 247 - Admin Key Test Helper
- Added **Test Key** button in Admin Dashboard → Settings → Backend Admin Key.
- It verifies the saved ADMIN_KEY against `/api/admin/system-health`.
- No Priority 2 flows touched: Cart/Like/Bell/Message, My Purchases, PA/BM user download flow.
- Firebase Rules not required for this patch.
