# AZOBSS Patch 1084 — Google Direct Sign-In Without Firestore List Queries

Baseline: v1083

Root cause fixed:
- Production Firestore rules intentionally use `allow list: if false` for `users` and Admin-only list for `usernameAuthEmails`.
- Earlier Google auth code still depended on collection queries to rediscover the signed-in user, so normal users could fall back into `Complete Profile` even when their profile was already complete.

Changes:
- Google login now resolves the owner with direct `getDoc()` lookups first.
- Direct candidates include saved mapping, Firebase Auth displayName, and normalized Google email local-part.
- Completed auto-created Google profiles are no longer treated as temporary.
- Exact Google-email owner matching has a direct document path before legacy queries.
- Successful Google login stores the AZOBSS username in Firebase Auth `displayName` as a durable private-browser/new-device lookup marker.
- Auth-state also reuses the trusted direct Google profile before considering Complete Profile.
- Existing Firestore security rules can remain unchanged.

Expected behavior:
- First Google registration / first account link: Complete Profile once if phone is missing.
- After `phone + uid + exact authEmail + Google link` are stored: subsequent Google sign-ins go straight in, including Private Browsing.

Package version: 1.0.1084
