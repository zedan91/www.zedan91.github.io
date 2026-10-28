# AZOBSS Patch 1075 — Secure Google Existing Account Linking

Baseline: v1074

## Secure linking
- Existing AZOBSS username is no longer shown as an open field by default.
- Google Complete Profile shows **Already have an AZOBSS account? Link existing account**.
- Link panel requires **AZOBSS Username + AZOBSS Password**.
- Password is verified using a separate in-memory Firebase Auth instance before linking.
- Google credential is linked to the existing Firebase UID only after successful password verification.
- Existing Firestore profile remains authoritative; role/Admin/Staff/PA-BM/pricing/history settings are preserved.
- Existing password authentication email is preserved; Google email is stored separately as `googleEmail`.
- Temporary auto-created Google profile is deleted when safe. If Firestore deletion is blocked, it is marked hidden/linked-away and excluded from Admin Registered Users.
- Temporary Google Firebase Auth user is removed before linking so the Google credential can be attached to the existing account UID.
- New Google-only users can simply enter phone and Save & Continue; `googleProfileConfirmed` prevents repeated prompts.

## Current v1073/v1074 temporary profiles
A profile such as `zedan9107` can now be securely linked to an older account such as `zedan91`. After a successful link, `zedan91` remains the main profile.

Package version: `1.0.1075`
