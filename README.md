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
