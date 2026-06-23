# Deploy Notes

Deploy this ZIP normally.

Render:
- Rebuild/deploy is required.
- No new ENV is required.
- Recommended production setting: leave `AZOBSS_VERIFY_TOYYIB_CALLBACK` unset or set to `1`.
- Do NOT set `AZOBSS_ALLOW_UNVERIFIED_TOYYIB_CALLBACK=1` unless ToyyibPay API is down and admin accepts manual risk.

Firebase:
- No Rules update required.


## PATCH 304 - Admin Website Health Report / Export
- Adds Admin > System Report.
- One-click full website check with copy/export TXT, JSON, CSV, and Print/Save PDF.
- Report combines page checks, backend health, maintenance scan, payment logs/premiumOrders, commission records, support and notifications.
- No Firebase Rules update required. Render backend is not required for this frontend-only patch if patch 303 backend is already active.

## PATCH 305 - Admin Payment Notification Center
- Adds private admin-only Payment Alerts for paid PA/BM, Software and CAD payments.
- New backend endpoints: `/api/admin/payment-notifications` and `/api/admin/payment-notifications-action`.
- Backend writes `adminNotifications` with Firebase Admin SDK after strict paid finalization.
- Render backend deploy is required.
- Firebase Rules update is not required.


## Patch 307 - Customer My Purchases Pro
- Customer My Purchases now supports PA/BM + Software + CAD records.
- Includes category/status/search filters, receipt HTML/PDF, active download action, and Contact Admin shortcut.
- Backend adds protected /api/my-purchases and /api/my-purchases/receipt/:id endpoints.
- Render backend deploy required. Firebase Rules update not required.
