# AZOBSS v1236 — Sales Partner Role Sync + Apply Button Fix

## Fixed
- `Become an AZOBSS Sales Partner` now disappears automatically for Staff, Manager, Semi-admin, Administrator/Admin, Owner and other staff-like accounts.
- Role detection no longer depends only on an early/stale localStorage snapshot. The Software Tools page now checks:
  - live AZOBSS body role classes,
  - current saved AZOBSS profile,
  - authoritative Firestore `users/{username}` profile,
  - approved Sales Staff application status.
- The section re-syncs when AZOBSS login/profile state changes, when the body role class changes, on focus/visibility resume, and after initial auth startup delays.
- Async race protection prevents an older `User` check from re-showing the application banner after the Staff profile is already resolved.
- `Apply Now` is explicitly clickable for ordinary users (`pointer-events:auto`, local stacking context) and waits briefly for Firebase Auth to finish restoring an already logged-in session before deciding login is required.
- Sales Partner modal explicitly restores pointer events/z-index when opened, preventing click-through / stale hidden-overlay state.

## Preserved
- Pending applications remain `Application Pending` and cannot be re-submitted until reviewed.
- Rejected applications can use `Reapply`.
- Approved applications and all Staff-or-higher roles never see the application banner.
- Existing Firestore rules from v1228 remain compatible; no new rule deployment is required for this patch.
- All v1235 commission symbol and Home promo fixes are preserved.
