# AZOBSS Patch 1241 — Ordinary User Apply Banner + English Commission Copy

## Root cause
The v1240 hard-hide fix correctly stopped Staff accounts from seeing the Sales Partner banner, but the Sales Partner module could still treat stale browser-wide Staff signals from a previous/current session as authoritative. `showPartnerSection()` also performed its own generic Staff re-check after Firestore had already resolved the current account as an ordinary User. This could keep `Apply Now` hidden for a real User account.

## Fix
- Firestore `users/{username}` role is now authoritative when successfully loaded.
- Ordinary roles such as `User` override stale Staff cache/body signals for that current account.
- Removed account-agnostic `azobss_staff_role_cache` from Sales Partner eligibility decisions.
- `showPartnerSection()` no longer re-hides a banner after the caller has already resolved the current role.
- Staff/Manager/Admin still remain fully hidden.
- User/Pending/Rejected states can show the application banner correctly.
- Commission & Share Link description changed fully to English.
- Software share text changed to English.
- Cache-buster updated to `v=1241`.

## Expected behaviour
- User: banner visible + Apply Now.
- Pending: banner visible + Application Pending.
- Rejected: banner visible + Reapply.
- Staff / Manager / Semi-admin / Administrator / Admin / Owner: banner hidden.
