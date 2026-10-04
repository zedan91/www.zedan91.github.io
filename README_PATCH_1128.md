# AZOBSS Patch 1128

## Invite / Benefit Code Membership Refactor

- Removed Invite Code from Sign up.
- Invite/benefit codes no longer grant or restore PA/BM access. PA/BM is controlled only by explicit Admin Dashboard PA/BM access.
- Current legacy PA/BM member code in v1127 was `ZX6186`; v1128 keeps it only as historical data and no longer treats it as an access password.
- Added Membership / Benefit Code redemption after login in Profile Settings.
- Added Admin Dashboard > Settings manager to create/change benefit codes with package name, price, duration in months, max uses, active status, category discounts and extra note.
- Benefit codes are validated server-side and are not publicly readable from Firestore.
- Redeeming a code writes time-limited membership benefit data to the user profile; it never writes PA/BM allow flags.
- Active package discounts integrate with the existing per-category pricing adjustment engine.
- Backend endpoints: /api/invite-benefit/admin/list, /admin/save, /admin/delete, /redeem.
- Frontend + backend deployment required.
