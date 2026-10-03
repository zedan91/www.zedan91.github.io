# AZOBSS Patch 1082 — Google Complete Profile Direct Sign-In Fix

Baseline: v1081

Fixes:
- A Google user whose Firebase Auth UID already matches the AZOBSS Firestore profile UID and whose verified Google email exactly matches the profile authEmail is now treated as already linked.
- Complete Profile no longer reappears just because older googleAuthLinked/googleEmail marker fields were missing or incomplete.
- Existing phone/phoneNumber is reused and completion/link flags are backfilled automatically.
- Future Google sign-ins go directly into the linked AZOBSS username when the profile is already complete.
- No Firebase Rules change is required beyond the v1081 rules already deployed, because this backfill occurs after UID ownership is established.

Package version: 1.0.1082
