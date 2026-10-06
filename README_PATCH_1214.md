# AZOBSS v1214 — AZDM Verified Login / Stale Token Recovery Fix

This patch continues v1213 and fixes the case where AZDM says the real email is not verified even though the AZOBSS account is already logged in and accepted by the website.

## Fixes
- AZDM backend now checks the authoritative Firebase Auth user record when the ID token still carries a stale `email_verified=false` claim.
- Legacy AZOBSS username accounts are resolved across `uid`, `authUid`, `firebaseUid`, `userUid`, direct `users/{username}` documents and UID-bound `usernameAuthEmails` mappings.
- The real receiving email can be recovered from `contactEmail`, `googleEmail`, `realEmail`, `authEmail`, `email` or `emailAddress`, but only when it is bound to the authenticated UID/legacy username and the account/profile is verified.
- AZDM purchase/order requests now force-refresh the Firebase ID token before authenticated checkout/order actions, avoiding a stale verification claim after login/email verification.
- The changed Software Packages JavaScript cache key is bumped to `v=1214`.

Security is unchanged: browser-supplied email/user IDs are never trusted for license delivery.

Package version: `1.0.1214`.
