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
- Moved AZOBSS Radio trigger from floating bottom/right button into the top navbar, directly before the username/account area.
- On mobile, the Radio button is also placed before the username/account icon area.
- Radio panel opens as a right-aligned dropdown and still supports Minimize, Play, Stop, Volume, full Malaysia station list, page-navigation restore, and random channel button.
- Floating mode is kept only as a fallback if a page has no navbar user tools.
- Cache bust updated to azobss-radio-player.js?v=358.


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
- Radio icon is no longer inserted inside `#marketUserTools`, because that area is hidden for guests.
- Radio now mounts before Register/Login for guests and remains left of username/account tools after login.
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
- Chinese-language stations removed from Top Radio-Online.My group and placed under Chinese.
- Indian/Tamil-language stations removed from Top Radio-Online.My group and placed under Tamil / Indian.
- Top group now stays focused on mainstream Malaysia/Malay/English stations first.
- Dropdown group order is now enforced so Chinese and Tamil / Indian sections appear lower, not mixed into Top.
- Cache bust updated to azobss-radio-player.js?v=367.


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


## AZOBSS Patch 429 - Software Meta Long Category Own Row Fix
- Fixes long Software category badge clipping on product cards.
- Category badge (example: Live Streaming Tools) is forced onto its own visible row.
- Version, file size and platform badges remain below it.
- Frontend-only change. Firebase Rules and Render backend deploy are not required.

## Patch 430 - Software Like Count Beside Rating
- Added visible software like count beside the rating area in the card footer.
- Likes are shown to the left of the star rating using existing manual/live stats value.
- Footer spacing was tightened for mobile so downloads, likes and rating stay on one line.
- Frontend only. No Firebase Rules update required. No Render backend deploy required.


## Patch 431 - Software Like Count Click Fix (2026-07-05)

- Made the like count pill beside the rating clickable.
- Clicking the like count now triggers the existing heart like button on the card.
- Like/unlike now updates the visible software like count and syncs to `settings/softwareStats`.
- Added hover/focus states so the count looks interactive.
- No backend, payment, ToyyibPay, Firebase Rules, or Render deploy changes required.


## PATCH 432 - Software Like vs Bookmark Separation
- Top-right card button is now Bookmark/Save (🔖), not software like.
- Footer heart count is the real software like count.
- Footer like button toggles software like count directly and stores one-like-per-browser/user marker.
- Bookmark action no longer changes software like count.
- No Firebase Rules update required.
- No Render backend deploy required.


## Patch 433 - Bookmark Icon Clarity Fix
- Top-right software/CAD card control now uses a clearer SVG bookmark icon instead of an emoji.
- Sticky bar `/likes/` shortcut now shows a bookmark icon and label `Bookmarks`.
- User dropdown label changed from `Likes` to `Bookmarks` for saved/bookmarked items.
- Bottom software like count remains the real software-like action and is not changed into bookmark.
- No backend, payment, Render, or Firebase Rules changes required.

### Patch 434 - Bookmarks page icon and Remove wording
- Updated `/likes/` saved-item cards to use the current bookmark SVG icon instead of emoji/heart wording.
- Changed `Unlike` action text to `Remove` because the page is now Bookmarks, not software-like count.
- Updated empty/login text to say bookmarks and bumped likes sync cache to `v=434`.
- No Firebase Rules update required. No Render backend deploy required.



## Patch 435 - Bookmarks URL Route Fix
- Changed user-facing Bookmarks URL from `/likes/` to `/Bookmarks/`.
- Updated sticky bar and dropdown links to `/Bookmarks/`.
- Added `/Bookmarks/index.html` as the active Bookmarks page.
- Removed the old `/likes/` redirect folder completely; only `/Bookmarks/` remains active.
- Updated cache versions for bookmark/auth scripts to `v=436`.
- No backend/payment changes.


## Patch 436 - Remove Old Likes Route Completely
- Deleted the old `/likes/` redirect folder entirely.
- Removed `/likes` page detection from the bookmark script.
- Removed old `likes/` URL normalization for user-facing links.
- Active user-facing bookmark page is now `/Bookmarks/` only.
- Updated cache versions to `v=436`.

## Patch 437 - Software Like Count Stable Toggle Fix (2026-07-05)
- Fixed intermittent Software like count issue where like/unlike sometimes did not increase/decrease after clicking.
- Root cause: software stats normalization only treated rating fields as remote stats, so Firestore `likes` could be overwritten by stale card dataset values.
- Updated stats normalization to preserve remote `likes`, `downloads`, `likedBy`, `ratings`, and rating fields correctly.
- Added pending-lock handling for Software like clicks so older Firestore sync responses do not overwrite the optimistic like/unlike state while saving.
- Synced local liked state from Firestore `likedBy` per voter/client to avoid mismatch between local state and remote count.
- No backend/payment changes.

## Patch 438 - Software Like Count No Revert Fix
- Fixed software like count that could increase by 1 and then suddenly drop back down.
- Removed the immediate Firestore reload after a like/unlike transaction because some browsers could briefly receive an older cached stats document.
- Added a short stale-remote guard so newer local click results are not overwritten by older remote stats during sync.
- Bookmark button remains separate from software likes.
- Frontend-only fix. Firebase Rules and Render backend deployment are not required.


## Patch 439 - Bookmarks product share link fix
- Bookmarks page now opens product-focused page URLs instead of direct download/GIF links.
- Software bookmarks open `/Software-Tools/?product=<id>&source=software` so only the selected software card is shown, same behavior as product share links.
- CAD/Affiliate bookmarks use their own product-focused routes when item IDs are available.
- Existing old bookmarked rows with direct download links are converted at display/click time when product/item ID exists.
- No backend or Firebase Rules changes required.

## Patch 440 - Software Like Count Stable Unique Toggle Fix (2026-07-05)

- Fixed Software Tools bottom like count sometimes reverting after Like/Unlike.
- Fixed one click sometimes being counted like two likes.
- Software like count now uses a stable formula: `likesBase + unique likedBy users/devices`.
- Old remote Firestore snapshots are ignored for 60 seconds after a local like/unlike action so stale data cannot overwrite the new visible count.
- Bookmark button remains separate and does not affect software like count.
- No backend or payment logic changed.
- Firebase Rules update is not required.

## Patch 441 - Bookmarks Add to Cart Button
- Added an `Add to Cart` button beside `Remove` on the `/Bookmarks/` page for saved Software/CAD items.
- Bookmark cart button uses the same normal product-focused link/id data so bookmarked software can be added from Bookmarks without opening the card first.
- Click guards prevent the Bookmarks card from redirecting when pressing Add to Cart or Remove.
- Bookmarks page cart quantity stays limited to 1 per item, matching the Software/CAD cart behavior.
- Bumped live likes/bookmarks sync asset cache to `v=441`.
