# AZOBSS v1328 — Shopee Import Strict Firestore Cloud Save

Baseline: v1327 full website package.

Changes:
- Shopee JSON import now performs a strict Firestore preflight read before writing.
- Shopee rows are considered imported only after Firestore confirms the write.
- Removed localStorage product fallback for failed Shopee imports.
- Existing local Shopee rows are migrated to Firestore only after a successful cloud write.
- Existing static Shopee rows are hidden only after a successful Firestore replacement.
- Added import status summary: cloud saved, new, updated, duplicate-in-file, skipped, failed Firestore.
- Added `Retry Failed (N)` for failed Shopee Firestore writes.
- Failed queue is kept in the current page session only; retry re-reads the cloud catalog before writing to reduce duplicate risk.
- Generic AZOBSS JSON import behaviour is preserved.

Package version: 1.0.1328
