# AZOBSS Patch 1077 — Google Stale Auth Repair

Baseline: v1076

## Main fix
For an existing Firestore profile whose registered `authEmail` exactly matches the verified Google provider email, AZOBSS no longer immediately asks for an old password when the old Firebase Email/Password user is missing.

Example:
- Google: `zedann.0002@gmail.com`
- Firestore profile: `users/zedan0002`
- `authEmail`: `zedann.0002@gmail.com`

If Google was previously linked to the wrong Firebase account (for example `zedan0001`), AZOBSS removes only the Google provider from the wrong account and displays **Continue with Google Again**. Choosing the same Google account again creates/signs into the correct Google Firebase identity and attaches it to `zedan0002`.

## Password rule
AZOBSS asks for the old AZOBSS password only when the second Google confirmation returns Firebase `account-exists-with-different-credential`, which is evidence that a live Firebase account using another provider still exists for that email.

## Safety
- Does not delete the existing Firestore profile.
- Does not delete the old Email/Password Firebase account when removing a wrong Google link.
- Requires the second Google popup to use the exact same Google email.
- Preserves the previous/stale Auth UID in `previousAuthUids` for audit.
- No manual Firebase Authentication user creation is required for the stale-auth case.

Package version: `1.0.1077`
