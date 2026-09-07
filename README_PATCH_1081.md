# AZOBSS Patch 1081 — Google Complete Profile One-Time + Phone Persistence Fix

Baseline: v1080

Fixes:
- Complete Profile is now a one-time Google onboarding/linking step, not a dialog that should appear on every Google sign-in.
- Phone is persisted to both `phone` and `phoneNumber`, plus `googleLastConfirmedPhone` as a recovery value.
- A successful Google profile save is verified by reading the Firestore user document back before the modal closes.
- Adds `googleProfileCompleted`, `phoneConfirmed`, and `googleProfileCompletedAt` markers.
- Subsequent Google sign-ins go directly into AZOBSS when the Google link and phone are already confirmed.
- Legacy profiles with a valid phone are automatically upgraded to the completed state.
- If a previous build left Firestore phone fields blank but a locally saved phone exists, AZOBSS silently repairs Firestore and signs in directly.
- Repairs stale Firebase UID on an already-confirmed Google-linked profile when the exact stored Google email matches the signed-in Google provider.
- Existing secure first-time linking with username/password is retained. Password is not requested again after a successful link.

Package version: `1.0.1081`
