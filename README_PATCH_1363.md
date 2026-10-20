# AZOBSS v1363 — Registered Users Email Grouping + Login Method + Non-Default Settings

## Registered User Records
- Groups Admin user records by normalized email for a cleaner account-centric view.
- Same email + different usernames remain as separate username rows inside the same email group.
- Same email + same username duplicate source records are visually merged only; source Firestore data is not deleted.
- Each username shows its sign-in method: Google, Login Biasa, or Google + Biasa when stored profile metadata supports both.
- Firebase UID remains visible per username.
- Only settings that differ from the normal defaults are emphasized:
  - non-User Account Role
  - PA/BM enabled
  - active Membership
  - Tempahan/Food Order access enabled
  - non-zero per-section price adjustments
- Fully default accounts show `Default settings` instead of multiple OFF/None/original badges.
- For duplicate records with the same username, non-default values are preserved in the merged display (for example, any PA/BM ON value wins over a default OFF record).
- Search works across email, username, phone, UID, role and login method.
- Pagination counts account/email groups while also showing username and raw-record totals.
- Edit modal now shows login method and Firebase UID for identity verification.

## Safety
- This patch does not destructively merge or delete Firestore user documents.
- Existing Edit/Delete/Tempahan actions remain scoped to their original username record.

## Deployment
- Frontend/Admin only. Existing v1360 backend can remain.
