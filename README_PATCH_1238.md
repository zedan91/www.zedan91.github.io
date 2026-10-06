# AZOBSS Patch 1238

## Admin Firestore query warning fix
- Adds the missing production Firestore rules for `supportMessages`, `notifications`, `commissionRecords`, `staffSoftwareSubmissions`, `staffCADSubmissions`, and `foodOrderStaffAccess`.
- Keeps v1224 AZOBSS Market rules and v1228 Sales Staff Application rules.
- Admin Notifications no longer depends on the `active + createdAtMs` composite query; latest notifications are read with a single-field ordered query and filtered client-side.
- Admin Dashboard `?tab=` deep links now support all main sidebar sections.

## AZOBSSTV Admin shell
- `/admin/AZOBSSTV/` now has the AZOBSS top navbar and the standard Admin side panel.
- AZOBSSTV remains highlighted as the active Admin section.
- Side-panel links return directly to the requested Admin Dashboard tab.
- Existing AZOBSSTV Remote Config, notifications, device, and heartbeat functions are preserved.

## Required deployment
Deploy `AZOBSS-Developer-Files/FIREBASE-RULES-AZOBSS-PRODUCTION-LOCKED-v1238-ADMIN-QUERY-FIX.txt` in Firebase Firestore Rules. The website package alone cannot change live Firestore permissions.
