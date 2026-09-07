# AZOBSS Patch 1078 — Remember Google Link / Direct Sign-In

Baseline: v1077

Fix:
- A successfully linked Google provider is now recognized before contact-email matching.
- AZOBSS checks the authenticated Firebase UID, confirmed Google-link flags, and stored `googleEmail`.
- If all match, Google Sign-In goes directly to the already-linked AZOBSS username.
- Existing AZOBSS password is required only during the first secure link (or when Firebase reports a genuine account conflict).
- Phone completion is still requested only if the linked profile has no phone number.
- `contactEmail` remains non-authoritative for first-time automatic account ownership.

Security conditions for passwordless repeat Google login:
1. Firebase user currently contains the Google provider.
2. Firestore profile resolves from that Firebase UID.
3. Firestore profile UID matches the authenticated UID.
4. `googleAuthLinked` is true and the profile is confirmed/linked.
5. Stored `googleEmail` exactly matches the verified Google-provider email.

Package version: `1.0.1078`
