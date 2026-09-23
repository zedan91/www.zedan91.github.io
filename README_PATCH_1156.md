# AZOBSS Patch 1156 — Admin Navigation Consolidation

Baseline: v1155.

## Changes
- Admin sidebar consolidated to the requested structure: Dashboard, Users, Sales & Receipts; Support & Sales; System.
- Dashboard is now the default admin page and still uses manual data loading to protect Firestore quota.
- Sales Overview, Payment Logs and Payment Alerts are retained as sub-tabs under Sales & Receipts.
- Online Users and Staff Roles are retained as sub-tabs under Users.
- Activity and Audit Logs are retained as sub-tabs under Logs & Activity.
- System Health, Frontend Check and Full Website Report are retained as sub-tabs under System Health.
- Frontend Check is now a true separate sub-tab while preserving all existing diagnostic button IDs and logic.
- Lucky Draw placeholder shortcut was removed from Admin sidebar/section; the existing /lucky-draw/ admin page is unchanged.
- Payment alert badge is preserved on the consolidated Sales & Receipts sidebar item.
- Existing section IDs and loaders are preserved so no sales/log/user/system feature is deleted.
