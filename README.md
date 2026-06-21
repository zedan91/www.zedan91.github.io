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


## AZOBSS 249 - Admin Frontend Diagnostics Fix
- Added Admin Dashboard > System Health > Admin Dashboard Frontend Check.
- Helps verify admin session, ADMIN_KEY storage, backend health, Firestore count, required DOM, and old Activity bug removal after deploy.
- Priority 2 areas were not touched.

## Patch 252 - Staff/Semi-admin Profile Lookup Fix
- Fixes /staff/ stuck message: "User profile not found or not linked to this login".
- Staff profile lookup now uses saved username hints, email mapping hints, displayName, and email prefix.
- Browser storage is used only to find the Firestore username document; access still requires the Firestore profile to match current Firebase uid/email and have staff/semi-admin/admin role or staff permission.
- Owner/admin fallback is still allowed only for whitelisted owner emails.
- No Firebase Rules or Render ENV update required.

## (254) STAFF OWN-RECORD SCOPED QUERY FIX

This patch continues from (253) and focuses on Staff/Semi-admin dashboard data visibility.

Changes:
- Staff dashboard no longer attempts broad collection reads for staff views.
- Staff-owned lists now query using scoped owner identifiers such as uid/email/username fields.
- Commission, software submission, CAD submission and purchase/sales views are filtered to own records before display.
- Admin/owner can still view broad admin-level staff data.
- Backend API fallback for commission remains available and protected by Firebase token auth.

Not changed:
- Cart / Like / Bell / Message badge.
- My Purchases.
- PA/BM paid/verified download flow.
- Maintenance payment/token repair.
- Firebase Rules.
- Render ENV.

Checks:
- staff/index.html inline module syntax OK.
- deploy-server.js syntax OK.
- ZIP root packaging must stay flat.


## Patch 255 - Staff PA/BM No Commission Fix
- Staff Dashboard Sales View excludes PA/BM purchase records from staff commission.
- Staff commission sales are now scoped to Software/CAD owner/staff/seller fields, not buyer username/email.
- PA/BM remains visible in Admin Purchase/Payments only; PA/BM download/payment flow not touched.


## Patch 257 - Staff Dashboard No PA/BM Mention UI Fix
- Removed visible PA/BM explanation/card/empty-state wording from Staff/Semi-admin Dashboard.
- Staff Dashboard now focuses on eligible staff sales, share link commission and payout only.
- Internal filtering remains active, but PA/BM is no longer mentioned in staff UI.
- No Firebase Rules or Render ENV update required.
