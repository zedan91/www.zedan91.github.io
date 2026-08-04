# (446)-AZOBSS-SOFTWARE-REMOVE-COMMISSION-CARDS-FIX_20260705

Patch 446 removes the Commission Policy / Private Sales Access card and the empty green commission note card from `/Software-Tools/`. No backend, payment, Render, or Firebase Rules changes are required.

# (444) AZOBSS Bookmarks Strict Free Cart Hide Fix

Patch 444 fixes the Bookmarks page still showing Add to Cart for Free Software items such as Bandizip.

## Changes
- Add to Cart in `/Bookmarks/` now requires a clear paid/premium marker or a real RM/MYR price.
- Free software bookmarks do not show Add to Cart.
- Old bookmark records with URL/file/version data inside price-like fields are no longer mistaken as paid products.
- Removed the old fallback that treated `paymentLink`/download URL alone as paid.
- Cache version updated to `v=444`.

## Deploy
Frontend/GitHub Pages only.
Firebase Rules do not need updating.
Render backend does not need redeploy.


## Patch 445 - Software Sort Most Likes Fix
- Removed mistaken `Ebook` option from Software Tools Sort by dropdown.
- Added `Most Likes` option to Software Tools Sort by dropdown.
- Uses existing likes sort logic (`sortMode = likes`) so products can be ordered by software like count.
- No Firebase Rules update required.
- No Render backend deploy required.


## Patch 447 - Bookmark & Share Button Alignment
- Aligns the top-right Bookmark button with the Share button on Software/CAD cards.
- Uses the same right offset and button size for both controls.
- Desktop: 38px buttons, right 16px. Mobile: 34px buttons, right 14px.
- Frontend-only. No Firebase Rules or Render backend changes required.


## Patch 448 - Preview Button Align Fix
- Aligns Preview button with the same right rail as Bookmark and Share buttons.
- Desktop rail: Bookmark top 16px, Share top 64px, Preview top 112px; all 38px.
- Mobile rail: Bookmark top 16px, Share top 60px, Preview top 104px; all 34px.
- Front-end only. No Firebase Rules or Render backend changes required.


## Patch 449 - Software Mobile Fit + Compact Download Button
- Fixed mobile Software Tools filter panels so platform/type/category buttons no longer overflow or crop on phone.
- Made admin toolbar wrap safely on mobile.
- Reduced mobile Download Now / Buy Now button width and height so it no longer appears too large.
- Front-end CSS only. No Firebase Rules update. No Render backend deploy required.


## Patch 450 - Compact Preview/Share/Bookmark Buttons

- Preview now sits on the left side of Share on Software/CAD product cards.
- Bookmark, Share and Preview controls are slightly smaller and aligned more compactly.
- No backend, payment or Firebase Rules changes.


## Patch 460 — Free Promo card layout
- Prevents the Free promo unit badge from overlapping the Bookmark control.
- Enlarges the Normal Price card and normalizes numeric prices, e.g. `RM30`.
- Uses a thinner diagonal strike so the original price remains readable.
- Expands Free Promo Download to the available card width so the full label is visible.
- No Firebase Rules or backend changes required.


## Patch 463 — Software card fast first paint
- Shows up to 8 cached Software cards immediately on repeat visits while Firestore refreshes in the background.
- Does not cache admin/staff edit/delete action buttons.
- Firestore software item load no longer waits for the separate softwareStats document before showing cards.
- Live stats, rating and promo quota refresh immediately after the stats request completes.
- Only `Software-Tools/index.html` changed. No Firebase Rules or Render redeploy required.

## Patch 464 — Free Promo Login Gate
- Free Promo Download is blocked for guests and anonymous Firebase sessions.
- The promo control is now a real button with no direct download URL in `href` or card data attributes.
- The download link is resolved only after a valid AZOBSS login and a successful quota transaction.
- Guest clicks show Login/Register prompt and do not reduce the free unit quota.
- Fast-card cache key bumped to v464 to discard old cached cards containing the previous direct link.
- No Firebase Rules or Render redeploy is required for this frontend patch.

## Patch (486)
- Removed the third-party software informational notice card above the software grid.

## Patch (490)
- Desktop category group dropdowns now open only when the cursor hovers over the group button.
- Normal mouse clicks no longer toggle or lock a dropdown open.
- Tap-to-open remains available on phones, tablets and coarse-pointer devices.
- Keyboard focus remains supported.
- Frontend only; no Firebase Rules or Render backend changes.

## Patch 491 - True Virtual Pagination Performance
- Only 8 software cards are inserted into the live DOM at one time.
- The full directory remains as JavaScript data for filtering and sorting.
- Prevents loading/rendering hundreds of hidden logos and complex cards.
- Replaces the old DOM-scanning pagination with data-based pagination.
- Category hover and filter clicks remain responsive even with 627 items.

AZOBSS 492
- Enlarged category group button labels slightly.
- Enlarged dropdown group heading and all subcategory labels.
- Increased dropdown row height slightly for easier reading.


## Patch 496
- Keeps the More chip above Download Now / Buy Now after card bottom alignment.
- Normalizes dynamically rendered More chips as direct card children without rebuilding the software list.


## Patch 527 - Register/Login Buttons Match Beli Pelan Akui
- Standardized Register as a green rounded pill and Login as a dark rounded pill across all pages that use the shared auth controls.
- The /Beli-Pelan-Akui/ page remains the visual reference and was not altered.
- Frontend CSS only. No Firebase Rules or Render redeploy required.


## Patch 542 - Beli Pelan Akui Navbar Glow Fix
- Restores the animated gold glow on the conditional Beli Pelan Akui navbar button only.
- Keeps all visibility/access rules and existing page layouts unchanged.
- Cache-busts `azobss-global-auth.js` to `v=542`.

## Patch (603) — Separate Copy and WhatsApp Buttons
- Replaced `Salin & Buka WhatsApp` with two independent actions on `/Tempah-Website/`.
- `Salin Mesej` copies the completed request message only.
- `Hantar ke WhatsApp` opens AZOBSS WhatsApp only and does not access or modify the clipboard.


## Patch 747 — Manual Invoice ToyyibPay QR
Pending manual invoices using ToyyibPay now include a QR payment link. Verified callback payment converts the same invoice record to a Paid receipt.

## PATCH 747 — ToyyibPay QR for manual invoices
Pending manual invoices using ToyyibPay now include a payment QR. Verified payment converts the same record into a Paid receipt and activates sales/profit recognition.


## Patch 771
Tempah Servis IT: kawasan servis terhad, autocomplete jenama/model, dan harga LCD 14/15 tanpa + serta LCD 16 RM350++.
