# AZOBSS Patch 1244 — Sales Partner Re-Apply Firestore Fix

## Fixed
- Fixes `Application could not be saved` when an account is currently `User` but has an older `salesStaffApplications/{uid}` record with `status: approved`.
- Firestore Rules now use the **current `users/{username}` role** as the authority. A current ordinary User can overwrite their own historical approved application back to `pending` and apply again.
- Staff/Manager/Admin accounts still cannot use the ordinary-user re-apply path.
- The frontend permission error no longer incorrectly tells users to deploy the old v1228 rules; it now points to v1244.
- Sales Partner module cache-buster updated to `v=1244`.

## Deployment required
Publish `AZOBSS-Developer-Files/FIREBASE-RULES-AZOBSS-PRODUCTION-LOCKED-v1244-SALES-STAFF-REAPPLY-FIX.txt` in Firebase Firestore Rules, then deploy the website package.

Package version: `1.0.1244`.
