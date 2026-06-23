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


## (309) Admin Commission + Staff Roles Compact Card Fix
- Compact card layout for Admin > Commission Manager > Commission Records.
- Compact card layout for Admin > Staff Roles > Latest Staff Users.
- No Firebase Rules update required.
- Render backend deploy not required.

## Patch 311 - Admin Software Card Duplicate Bottom Actions Fix

Frontend-only patch:
- Software admin card action buttons now float on the right side only.
- Duplicate bottom admin button row/background below Buy Now is removed.
- No backend/Render changes required.


## AZOBSS 313 - Admin Dashboard Header Compact Fix
- Compact Admin Dashboard topbar/header so it uses less vertical space.
- Compact section headings, subtitle spacing, hero/header cards and KPI/header spacing.
- Frontend only: admin/index.html.
- Firebase Rules: not required.
- Render backend deploy: not required.


## (314) AZOBSS Admin Dashboard Raise Tight Fix - 2026-06-23
- Raised Admin Dashboard content slightly closer to the top navigation.
- Reduced top padding in main admin area and sidebar.
- Tightened topbar and section title spacing so dashboard header takes less vertical space.
- UI-only patch: no Firebase Rules update required, no Render backend deploy required.

## Patch 318 - Staff Dashboard Header Compact Fix

Patch ini hanya UI frontend untuk `/staff/index.html`.
Render backend tidak perlu deploy semula.
Firebase Rules tidak perlu update.


## AZOBSS Patch 321 - Software/CAD Card Description Center Fix
- Centered Software/CAD card description text visually inside each card.
- More chip no longer makes the description look off-center.
- No Firebase Rules update. No Render deploy required.


## Patch 323 - Software/CAD More Button + Action Footer Gap Fix
- More button no longer touches/overlaps description text.
- Download Now / Buy Now is closer to the downloads/rating footer.
- GitHub Pages only; no Firebase Rules / Render required.
