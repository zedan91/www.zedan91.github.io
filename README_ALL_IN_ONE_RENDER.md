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


## Patch 359 - Radio Navbar Image Button
- Replaced the crowded `📻 Radio` text pill with a compact neon headphone image button beside username.
- Works on desktop and phone.
- Cache bust: `/assets/js/azobss-radio-player.js?v=359`.
- No Firebase Rules / Render deploy required.


## Patch 360 - Radio Navbar Icon Compact Beauty Fix
- Radio button beside username is now a smaller round headphone icon.
- Reduced navbar width/margin so it does not crowd nearby buttons.
- Cache bust: `/assets/js/azobss-radio-player.js?v=360`.
- GitHub Pages deploy only. No Firebase Rules/Render changes.

## Patch (361) - Radio Navbar Icon Smaller Fix

- Shrunk the navbar radio headphone button to avoid overlapping nearby username/icon buttons.
- Desktop icon reduced to about 28px.
- Mobile icon reduced to about 26px.
- Status dot reduced too so it does not crowd the navbar.
- Cache bust updated to `azobss-radio-player.js?v=361`.
- No Firebase Rules update required.
- No Render backend deploy required.

## Patch 362 - Radio Guest Navbar Visible Fix
- Radio icon is visible for guest and signed-in users.
- Mounted outside the signed-in-only user tools container.
- Cache bust updated to `azobss-radio-player.js?v=362`.
- No Firebase Rules or Render backend deploy required.


## Patch 364 - Radio Verified Stream List Fix
- Radio station list changed to stable/verified Malaysia station pool only.
- Risky stations that often return stream-not-found were removed.
- Added station aliases and local broken-station hiding for 12 hours.
- Cache bust updated to `azobss-radio-player.js?v=364`.
- No Firebase Rules or Render backend deploy required.


## Patch 365 - Radio Remove Search Box
- Removed radio search input/card from radio panel.
- Kept dropdown station list, random button, Play/Stop, volume and minimize.
- Cache-bust updated to `azobss-radio-player.js?v=365`.
- No Firebase Rules or Render backend deploy required.


## AZOBSS Radio Online.My Channel Reference List Fix (366)

AZOBSS RADIO ONLINE MY CHANNEL REFERENCE LIST FIX (366)

Changes:
- Updated AZOBSS Radio dropdown list to follow Radio-Online.My Malaysia station reference/order.
- Top Radio-Online.My channels stay at the top: ERA, SINAR FM, THR Raaga, Suria, Radio Klasik, Sarawak FM, THR Gegar, Astro Vani, MY FM, Melody FM, Hot FM, and more.
- Added more RTM state stations, Sabah/Sarawak stations, Astro/SYOK theme channels, Chinese/Tamil/English/news/local channels listed by Radio-Online.My.
- Kept previous compact navbar radio UI, no search box, random channel button, Minimize button, no Open button, and page-navigation restore.
- The player still resolves playable stream URLs via browser-side stream lookup and temporarily hides stations that fail on that browser.
- Cache bust updated to azobss-radio-player.js?v=366.

No Firebase Rules update needed.
No Render backend deploy needed.
Deploy GitHub Pages only.

## Patch 367 - Radio Top Group Language Order Fix
- Chinese-language stations moved out of Top group into Chinese.
- Indian/Tamil-language stations moved out of Top group into Tamil / Indian.
- Dropdown group order enforced and cache bust updated to azobss-radio-player.js?v=367.


AZOBSS RADIO SEARCH + OUTSIDE MINIMIZE FIX (PATCH 368)

Changes:
- Restored compact radio channel search input.
- Typing keyword filters the radio station dropdown instantly.
- Count text shows filtered channel count while searching.
- Clicking outside the open radio panel now minimizes the panel.
- Radio playback does not stop when minimized by outside click.
- Cache bust updated to azobss-radio-player.js?v=368.

Firebase Rules: not required.
Render backend deploy: not required.
Deploy GitHub Pages only.


## PATCH 369 - My Purchases Delete + Status Text Fix
- Added Delete button in My Purchases Pro.
- Pending records no longer show Download locked.
- Used Gmail download link now shows Downloaded/expired wording on card.
- Backend soft-delete endpoint added, so Render deploy is required.
- No Firebase Rules update required.


PATCH 428 - SOFTWARE META LONG CATEGORY FIX
- Long software category badges such as Live Streaming Tools now display fully on cards.
- Frontend CSS only; no Firebase Rules or Render backend deploy required.
