# AZOBSS Patch 1239 — Sales Partner Staff Visibility Hard Fix

- Fixes the `Become an AZOBSS Sales Partner` banner still appearing for Staff/Manager/Admin accounts.
- Root cause: the Sales Partner module could read a stale `getSavedUser()` object with role `User` while the Software Tools affiliate/commission module had already resolved the live account as Staff.
- Staff detection now uses all current role signals: live body role classes, Software Tools affiliate bar state, session/local saved user objects, direct role cache keys, staff role cache, and software role globals.
- Any staff-level signal immediately hides the whole Sales Partner application section and blocks stale async sync paths from showing it again.
- A MutationObserver watches the affiliate/commission role bar so the Sales Partner banner disappears immediately when the role resolver finishes.
- Ordinary User accounts remain eligible to see Apply Now. Pending/Rejected application behaviour is unchanged.
- No Firestore Rules change is required.
