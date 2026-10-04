# AZOBSS Patch 1076 — Exact Google Email Owner Match & Safe Relink

Baseline: v1075

## Main fix
Google Sign-In now resolves the **actual Google provider email** from `providerData` before deciding which AZOBSS profile owns the sign-in. This fixes cases where `firebaseUser.email` still belongs to an older Email/Password account after Google was linked to the wrong Firebase UID.

Example fixed flow:
- Google account: `zedann.0002@gmail.com`
- Firestore profile owner: `users/zedan0002` with matching `authEmail`
- Result: Google signs into **zedan0002**, not `zedan0001`.

## Safe automatic matching
- Exact `users.authEmail` match: automatic owner match.
- Exact `usernameAuthEmails.email` match: automatic owner match.
- `users.email` is automatic only when the profile has no separate `authEmail`.
- `contactEmail` alone is **not** trusted for automatic ownership; it requires username + password verification.
- Ambiguous multiple matches require secure manual linking.

## Repair of an incorrectly linked Google provider
If Google is currently attached to the wrong established Firebase account:
- only the `google.com` provider is unlinked from that account;
- the existing Email/Password Firebase user is **never deleted**;
- stale Google-link fields on the wrong Firestore profile are cleared;
- the Google credential is then signed in again and attached to the correct email owner.

If the correct target already has its own Firebase Email/Password identity, AZOBSS asks for that AZOBSS password once and links Google securely.

## UID preservation
If an older Firestore profile contains a stale Firebase UID and a new Google Auth UID has to be created, the old UID is preserved in `previousAuthUids` before the profile UID is updated.

## Preserved
- v1075 secure username + password linking UI
- Google phone completion flow
- Admin/Staff/PA-BM roles and profile fields
- v1074 Home Register/Login fix
- v1072 lot-processing button changes
- invoice/deposit/payment changes

Package version: `1.0.1076`
