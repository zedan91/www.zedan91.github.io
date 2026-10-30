# AZOBSS v1468 — Compact Sign Up + Google Quick Sign-In Prompt

Based on full v1467.

## Changes
- Sign Up form reordered to Username → Email → Password → Phone → reCAPTCHA.
- Removed confusing `Username / Email` label from registration; it is now `Username`.
- Empty signup error area is hidden so the form stays compact.
- Google/password recovery action stays hidden until it is actually required.
- Added a compact top-right `Sign in to AZOBSS with Google` prompt for logged-out customer pages.
- The prompt uses the existing Firebase Google popup flow; it does **not** fake Google One Tap/FedCM.
- Prompt is excluded from `/admin/`, hidden for authenticated users, hidden while the auth modal is open, and can be dismissed for the current browser session.
- Existing Sign in / Sign up with Google buttons and account linking logic are preserved.

## Note on official Google One Tap/FedCM
Official Google Identity Services One Tap requires a Web OAuth Client ID (`*.apps.googleusercontent.com`). The current source contains Firebase project configuration but no verified Web OAuth Client ID, so v1468 intentionally does not invent one. The prompt can later be upgraded to official One Tap without changing the existing Firebase account flow.

## Release
- Global badge/cache-bust: v1468
- Root-ready ZIP layout retained.
