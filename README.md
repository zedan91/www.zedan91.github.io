AZOBSS Mini Tools Compact Card Restore Fix (235)

- Keeps Mini Web Tools premium background and controls.
- Restores compact cards: icon, title and type only.
- Hides long descriptions, feature chips, badges and Open tool row from card list.
- No Firebase Rules or Render ENV changes required.

## Patch 243 - Admin Dashboard Query Warning Fix

Scope: Admin dashboard only.

Changes:
- Added visible Admin Dashboard query warning panel when Firestore query/count fails.
- Dashboard no longer silently looks like 0/empty data when actual issue is permission denied, missing index, unauthenticated session, or Firestore availability.
- Added labels for main admin queries: Overview, Registered Users, Activity, Online Users, Support, Notifications, Payments, Commissions, Settings.

Skipped / not touched:
- Cart, Like, Bell, Message badge.
- My Purchases.
- PA/BM paid/verified download flow and logic.

Firebase Rules:
- No new rules required by this patch.
- If warning says permission denied, publish the rules from previous admin email sync patch.

## AZOBSS Patch 245 - Admin Key ENV Sync + Admin Dashboard Key Helper

- `deploy-server.js` now treats `ADMIN_KEY` as a valid fallback for `AZOBSS_ADMIN_API_SECRET`, because Render startCommand uses `node deploy-server.js`.
- Admin Dashboard backend fetch now sends `x-admin-key` from browser storage key `azobssAdminApiKey`.
- Admin Dashboard Settings now has a Backend Admin Key helper to save/clear the key without opening DevTools console.
- Priority 2 skipped areas remain untouched: Cart/Like/Bell/Message badge, My Purchases, and PA/BM paid/verified download flow.


## Patch 246 - Deploy Server Admin Secret Strict Fix

Admin backend routes in `deploy-server.js` now require the configured `ADMIN_KEY` / admin API secret. Firebase profile role alone is no longer enough for deploy-server admin backend actions. This prevents a user-editable role/profile from being used to pass backend admin routes.

Not touched: Cart/Like/Bell/Message badge, My Purchases, and PA/BM paid/verified user download flow.


## AZOBSS 249 - Admin Frontend Diagnostics Fix
- Added Admin Dashboard > System Health > Admin Dashboard Frontend Check.
- Helps verify admin session, ADMIN_KEY storage, backend health, Firestore count, required DOM, and old Activity bug removal after deploy.
- Priority 2 areas were not touched.

## Patch 252 - Staff/Semi-admin Profile Lookup Fix
- Fixes /staff/ stuck message: "User profile not found or not linked to this login".
- Staff profile lookup now uses saved username hints, email mapping hints, displayName, and email prefix.
- Browser storage is used only to find the Firestore username document; access still requires the Firestore profile to match current Firebase uid/email and have staff/semi-admin/admin role or staff permission.
- Owner/admin fallback is still allowed only for whitelisted owner emails.
- No Firebase Rules or Render ENV update required.

## (254) STAFF OWN-RECORD SCOPED QUERY FIX

This patch continues from (253) and focuses on Staff/Semi-admin dashboard data visibility.

Changes:
- Staff dashboard no longer attempts broad collection reads for staff views.
- Staff-owned lists now query using scoped owner identifiers such as uid/email/username fields.
- Commission, software submission, CAD submission and purchase/sales views are filtered to own records before display.
- Admin/owner can still view broad admin-level staff data.
- Backend API fallback for commission remains available and protected by Firebase token auth.

Not changed:
- Cart / Like / Bell / Message badge.
- My Purchases.
- PA/BM paid/verified download flow.
- Maintenance payment/token repair.
- Firebase Rules.
- Render ENV.

Checks:
- staff/index.html inline module syntax OK.
- deploy-server.js syntax OK.
- ZIP root packaging must stay flat.


## Patch 255 - Staff PA/BM No Commission Fix
- Staff Dashboard Sales View excludes PA/BM purchase records from staff commission.
- Staff commission sales are now scoped to Software/CAD owner/staff/seller fields, not buyer username/email.
- PA/BM remains visible in Admin Purchase/Payments only; PA/BM download/payment flow not touched.


## Patch 257 - Staff Dashboard No PA/BM Mention UI Fix
- Removed visible PA/BM explanation/card/empty-state wording from Staff/Semi-admin Dashboard.
- Staff Dashboard now focuses on eligible staff sales, share link commission and payout only.
- Internal filtering remains active, but PA/BM is no longer mentioned in staff UI.
- No Firebase Rules or Render ENV update required.

## (262) Share Modal Staff/Semi-admin Commission Card Visibility Fix
- The commission explanation card in Software/CAD share modals is now shown only for staff/semi-admin style users.
- Normal logged-in users still see Lucky Draw credit active, but they no longer see staff/semi-admin commission percentages.
- Guest users continue to see product-link sharing only.
- PA/BM paid/verified download flow, My Purchases, Cart, Like, Bell, and Message badge are not touched.
- No Firebase Rules or Render ENV update required.

## Patch 263 - Admin Share Modal Product-Link UI
- Admin account sharing from Software/CAD now uses normal product-link wording.
- Admin no longer sees Lucky Draw credit badge/subtitle/note inside the share modal.
- Admin share URL no longer adds referral credit parameters.
- Normal logged-in users still receive Lucky Draw credit messaging.
- Staff/semi-admin commission card visibility from patch 262 remains unchanged.
- Guest share behavior remains product-link only.
- No changes to PA/BM download flow, My Purchases, Cart, Like, Bell, Message badge, Firebase Rules, or Render ENV.

## Patch 265 - Software/CAD Promotional Price Discount Display Fix
- Added optional Promo Original Price field for admin/semi-admin/staff item editing.
- Current Selling Price remains the actual payment/cart price.
- Premium Software/CAD cards now show old price with strikethrough, final promo price, and Save % chip when original price is higher than current price.
- Guest and normal logged-in users can see promotional price display.
- Admin/semi-admin/staff can edit the promo original price from the existing Software/CAD edit modal.
- PA/BM paid/verified download flow, My Purchases, Cart, Like, Bell, and Message badge are not touched.
- No Firebase Rules or Render ENV update required.


## (266) Software/CAD Promo Price Mobile Layout Fix
- Fixes promo price block overlapping Buy Now/cart/stats footer on mobile cards.
- Keeps promotional price display: old price struck through, final price highlighted, Save % badge.
- Does not change payment amount logic; checkout still uses final selling price.
- Does not touch PA/BM download flow, My Purchases, Cart/Like/Bell/Message badge logic.


## Patch 267 - Promo Price Mobile Stack Final Fix
- Fixed Software mobile card overlap/clipped Buy Now after promo price.
- Moved stats footer into normal mobile flow so card height expands naturally.
- Added matching CAD mobile promo/action safety.
- No Firebase Rules or Render ENV update required.

## (272) Promo Badge Narrow No Logo Overlap Fix
- Promo badge remains top-left but is narrowed so it does not touch product logo on mobile cards.
- Original price and Save % remain readable.
- Final price remains only in the Buy Now button.


## (274)-AZOBSS-PROMO-BADGE-OLD-PRICE-BIGGER-FIX_20260622
- Enlarged the crossed original promo price text (example: RM30) so it is clearer on mobile.
- Kept the promo badge compact at the top-left and avoided product logo overlap.
- Final selling price remains only inside the Buy Now button.
- No changes to PA/BM, My Purchases, Cart/Like/Bell/Message badge, Firebase Rules, or Render ENV.


## (275) AZOBSS Promo Badge Strike Line Transparent Readable Fix
- Adjusted Software Tools and CAD Tools promo old-price strike-through line.
- Strike line is now semi-transparent and thinner so values like RM30 remain readable.
- Keeps promo badge at top-left and final price only in the Buy Now button.
- No PA/BM, My Purchases, Cart/Like/Bell/Message, Firebase Rules, or Render ENV changes.


## AZOBSS Patch 276 - Promo Badge Diagonal Strike Fix
- Old promo price line is now diagonal/slanted and semi-transparent for better readability.
- Applies to Software Tools and CAD Tools only.
- No Firebase Rules or Render ENV changes required.


## (279) Shared Link Guest Stable Hydration Fix
- Audit dari video Bandicam: shared link masih nampak controls/stats blink kerana grid dibuka sebelum render auth/share/stats benar-benar stabil.
- Software/CAD shared product grid kini disorok sementara dengan skeleton “Preparing shared product…”.
- Release hydration menunggu card target, share button, preview GIF dan stats footer stabil beberapa tick sebelum paparan sebenar dibuka.
- Tidak sentuh PA/BM, My Purchases, Cart/Like/Bell/Message badge logic, Firebase Rules atau Render ENV.


## AZOBSS Patch 281 - Shared Link Instant Controls No Blink
- Software/CAD shared product links now show Like, Share, Preview GIF, rating and download stats immediately.
- Removed the shared-link control hiding/skeleton wait that made controls appear late.
- Seeded stable card controls in the initial card HTML, then later scripts update state silently in-place.
- Patched like button binding so pre-rendered Like buttons still work.
- Does not touch PA/BM flow, My Purchases, Cart/Bell/Message badge logic, Firebase Rules, or Render ENV.


Patch 283: shared-link instant controls/stats no-blink fix.
