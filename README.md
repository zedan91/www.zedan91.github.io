# (253)-AZOBSS-STAFF-BACKEND-ADMIN-IDENTITY-STRICT-FIX

Baseline: (252)-AZOBSS-STAFF-SEMIADMIN-PROFILE-LOOKUP-FIX_20260621.zip

## Purpose
Next priority after staff/semi-admin access is settled: tighten backend identity so staff/semi-admin/test accounts cannot be treated as backend admin by legacy username or role fallback.

## Changes
- Updated `deploy-server.js` `azCommissionIdentityFromRequest()`.
- `identity.isAdmin` now uses `azIdentityTrustedForBackendAdmin(identity)` only.
- Backend admin trust now follows server allow-list email/UID:
  - default admin emails: `zedan91@azobss.local`, `zedan9107@gmail.com`
  - optional ENV allow-lists: `ADMIN_ALLOWED_EMAILS` / `AZOBSS_ADMIN_EMAILS`, `ADMIN_ALLOWED_UIDS` / `AZOBSS_ADMIN_UIDS`
- Removed legacy backend-admin trust through username `zedan0001` / arbitrary Firestore `role: admin` for commission/admin-style reads.

## Not touched
- Cart / Like / Bell / Message badge
- My Purchases
- PA/BM paid/verified download flow
- Maintenance payment/token repair
- Firebase Rules
- Render ENV

## Checks
- `node --check deploy-server.js` OK
- ZIP structure flat/root ready for GitHub Pages + Render
