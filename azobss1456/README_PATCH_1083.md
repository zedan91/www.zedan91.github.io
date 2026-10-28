# AZOBSS Patch 1083 — Google Complete Profile Race / Phone Wipe Fix

Baseline: v1082

Fixes:
- Prevents Google auth-state/profile creation races from merging blank `phone` / `phoneNumber` into an existing user.
- Existing canonical Google `authEmail` owner is resolved before any new Google profile is allocated.
- Exact verified Google email can safely repair a stale UID using the already-published v1081 Firestore rules.
- Auth-state and normal-login syncs never write empty phone values over an existing phone.
- Google direct sign-in finalizes immediately when exact authEmail + UID + saved phone already match.
- Existing Google completion markers are backfilled idempotently.

Important for profiles already damaged by v1082:
- If `users/{username}.phone` is already blank, enter the phone once after deploying v1083.
- From then on, subsequent Google sign-ins should go straight in and the phone will no longer be erased by auth sync.

Package version: `1.0.1083`
