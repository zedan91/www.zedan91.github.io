# AZOBSS v1359 — Ebook Digital Access Manager UI & Audit Upgrade

Baseline: v1358.

## Ebook Access Admin
- Sidebar label shortened to `Keys & Digital Access`; page title remains `Software Key / Digital Access`.
- Rebuilt Ebook Access manager with three KPI cards: Total Buyers, Active Access, Revoked Access.
- Added compact Search + Status filter + Sort + Refresh toolbar.
- Main table is reduced to Customer, Contact, Access, Purchase, Payment and Actions.
- Long audit identifiers were moved out of the main table.
- Added `View` side drawer containing Firebase UID, Order ID, BillCode, Payment Reference and access audit timeline.
- Added copy buttons for audit IDs.
- Added `Last Used` tracking; successful lifetime-access checks update `lastAccessAt` for non-admin customers.
- Added responsive mobile card layout and cleaner pagination. Pagination hides when only one page exists.
- Revoke now supports an optional reason and stores admin, timestamp and reason.
- Restore stores admin and timestamp and clears the previous revoke reason.
- Added `Re-sync Access` for verified PAID orders. A manually revoked account must be restored before re-sync.
- Drawer locks background scroll and supports backdrop / Escape / close button.

## Backend
- `/api/admin/ebook-generator-access` GET now returns Last Used and full revoke/restore audit metadata.
- POST supports `revoke`, `restore`, and `resync`.
- Paid-order verification markers are required for re-sync.
- Access-status endpoint records Last Used without overwriting the admin-audit `updatedAt` timestamp.

## Preserved
- v1358 Stripe actual-fee synchronization and backfill.
- v1358 AZDM / SurveyCAD management.
- Ebook Generator RM19 one-time lifetime entitlement model.
