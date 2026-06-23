# (296) AZOBSS ToyyibPay Strict Verified Payment Only Fix

Critical security/payment patch.

Fixes:
- Cancelled/abandoned ToyyibPay payment must NOT show Payment Successful popup.
- Cancelled/abandoned ToyyibPay payment must NOT generate/send software download link.
- Receipt/download for Software/CAD premium orders is released only after ToyyibPay API confirms paid.
- Generic `status=success` or API `success:true` is no longer treated as paid.
- Callback trust bypass is disabled unless explicitly enabled by `AZOBSS_ALLOW_UNVERIFIED_TOYYIB_CALLBACK=1`.
- CAD manual complete purchase button no longer calls backend complete-purchase for normal buyers.

Notes:
- Firebase Rules: no update required.
- Render backend: deploy required because deploy-server.js changed.
- Keep AZOBSS_VERIFY_TOYYIB_CALLBACK default ON.
- Do not set AZOBSS_ALLOW_UNVERIFIED_TOYYIB_CALLBACK unless emergency.


## Patch 300 - Admin Payment Logs Pro Filter + Export

- Upgraded Admin > Payment Logs with stronger search, date filter, status filter, CSV export, and View Details modal.
- Keeps PA/BM reset download limit button unchanged.
- No Firebase Rules update required.
- No Render backend deploy required.


## PATCH 304 - Admin Website Health Report / Export
- Adds Admin > System Report.
- One-click full website check with copy/export TXT, JSON, CSV, and Print/Save PDF.
- Report combines page checks, backend health, maintenance scan, payment logs/premiumOrders, commission records, support and notifications.
- No Firebase Rules update required. Render backend is not required for this frontend-only patch if patch 303 backend is already active.

## PATCH 305 - Admin Payment Notification Center
- Adds Admin > Payment Alerts for private admin-only payment notifications.
- Backend creates a deduplicated admin notification when a PA/BM, Software, or CAD Tools ToyyibPay order is finalized as paid.
- Adds unread badge, overview KPI, search/filter, mark read, mark all read, clear read, and direct shortcuts to Payment Logs/Sales Overview.
- Uses backend Admin SDK collection `adminNotifications`; no public user notification collection is used for payment details.
- Firebase Rules: no update required.
- Render backend: deploy required because `deploy-server.js` changed.


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

## PATCH (310) - Admin Remaining Lists Pagination
- Added pagination to remaining long admin lists: Support Inbox, Notifications, Payment Alerts, Payment Logs, PA/BM Summaries, Commission Records, Payout Requests, Staff Roles, Online Users, and Audit Logs.
- Existing Registered Users and Activity pagination were preserved.
- Firebase Rules update: not required.
- Render backend deploy: not required.

## Patch 311 - Admin Software Card Duplicate Bottom Actions Fix

- Fixed admin-only Software card issue where duplicate admin buttons/background appeared below the Buy Now row on mobile.
- Reused the existing admin action wrapper instead of appending another duplicate wrapper.
- Forced admin action buttons to float at the right side only for Software product cards.
- No Firebase Rules update required.
- No Render backend deploy required; GitHub Pages deploy only.


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

- Rapatkan header Staff/Semi-admin Dashboard ke atas.
- Kecilkan sedikit tajuk `Staff Dashboard`.
- Kurangkan jarak subtitle dan hero card.
- Padatkan hero card, quick action button dan KPI bahagian atas.
- Hanya ubah `/staff/index.html`.

Firebase Rules: tidak perlu update.
Render backend: tidak perlu deploy semula.
Deploy: GitHub Pages sahaja.


## AZOBSS Patch 321 - Software/CAD Card Description Center Fix
- Centered Software/CAD card description text visually inside each card.
- More chip no longer makes the description look off-center.
- No Firebase Rules update. No Render deploy required.
