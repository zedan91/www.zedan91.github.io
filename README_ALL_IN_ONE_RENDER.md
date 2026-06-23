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

## AZOBSS Patch (306) - Admin Payment Receipt / Invoice PDF

- Added Admin Payment Logs receipt actions: Receipt, PDF, and Email Receipt.
- Added protected backend receipt endpoints for PA/BM `purchaseLogs` and Software/CAD `premiumOrders`.
- Added PDF receipt generation using backend `pdfkit`.
- Customer Software/CAD receipt token URL now supports `format=pdf`.
- No Firebase Rules update required.
- Render backend deploy required because `deploy-server.js` changed.

