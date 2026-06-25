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


## Patch 324 - Software/CAD card action bottom pin
- Download Now / Buy Now pinned close to downloads/rating footer.
- More chip no longer takes its own row.
- No Firebase Rules update. No Render deploy required.


## Patch (326) - Software/CAD desc 3-line real page clamp
- Fixed issue where desc clamp did not appear because previous patch was not injected into actual /Software-Tools/ page.
- Added real 3-line ellipsis clamp to Software Tools and CAD Tools pages.
- Kept Download Now / Buy Now pinned near footer downloads/rating.
- No Firebase Rules update. No Render deploy required.


Patch 329: Software/CAD card description clamp changed from 3 lines to 4 lines. No Firebase Rules or Render backend update required.


## AZOBSS Patch 330 - Software/CAD Description Real 4-Line Height Fix
- Fix real 4-line description: previous 329 clamp had 58px height, causing only ~3 visual lines.
- Now desc container and inner span get actual 4-line height using CSS calc.
- Applies to Software Tools, CAD Tools and root fallback.
- No Firebase Rules update. No Render backend deploy required.

## Patch (334) - AZOBSS Navbar Username Lock Fix
- Navbar now prioritizes official AZOBSS username instead of Gmail/Firebase displayName.
- Adds username lock cache by uid/email and a safe text guard for `#signedInName`.
- Email login no longer creates a navbar name from Gmail prefix when real username can be resolved.
- Files changed: `assets/js/azobss-global-auth.js`, `main.js`.
- Firebase Rules: not required. Render deploy: not required.


## (346) AZOBSS SOFTWARE FREE DOWNLOAD COUNT FIX
- Fixed Free Software Download Now count not increasing.
- Root cause: stats script detected any button with `data-product-price` as premium, and Free buttons also carried that attribute.
- Now only real premium buttons/payment links/Buy Now are skipped.
- Buy Now still does not increment downloads before payment.
- Firebase Rules: no update required.
- Render backend: no deploy required.


## Patch 351 - Radio Floating Right Align Fix
- Radio floating button now stays close to the right side of the screen.
- The hidden panel no longer pushes the Radio pill inward.
- GitHub Pages deploy only. No Firebase Rules or Render deploy required.

## Patch (354) - Radio All Pages Install
- Added AZOBSS Radio Player to every HTML page, including Affiliate Shop, Lucky Draw, PA/BM, Likes, Mini Tools, Docs, Admin and Staff.
- Cache bust updated to `azobss-radio-player.js?v=355`.
- No Firebase Rules update required.
- No Render deploy required.



## Patch 355 - Radio Minimize Button
- Replaced radio panel X button with "− Minimize" to avoid user confusion.
- Minimize hides the panel but keeps radio playing; Stop remains the only stop control.
- Cache-bust updated to `azobss-radio-player.js?v=355`.


## Patch 356 - AZOBSS Radio Remove Open Button
- Removed Open button from radio panel to avoid confusion.
- Radio now has Play / Stop / Volume / Minimize only.
- Cache-bust updated to v356.
- GitHub Pages deploy only. No Firebase Rules or Render deploy required.


## Patch 357 - AZOBSS Radio Random Channel Button
- Added small 🔀 random channel button beside radio station dropdown.
- If radio is playing, random switches and plays a new station immediately.
- If radio is stopped, random only selects a station; user can press Play.
- Cache bust updated to azobss-radio-player.js?v=357.
- No Firebase Rules or Render deploy required.

## Patch 358 - Radio Navbar Button Beside Username
- Radio button moved beside username in navbar on desktop/mobile.
- Floating mode remains fallback only if navbar target is missing.
- No Render deploy required; static assets only.
