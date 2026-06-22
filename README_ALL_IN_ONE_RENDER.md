Deploy as usual to GitHub Pages / Render static project. No new server environment variables required.


## (254) Staff Own-Record Scoped Query Fix
Deploy as usual. No Render ENV change required. No Firebase Rules update required for this patch.

## Patch 265 - Software/CAD Promotional Price Discount Display Fix
Deploy normally. No Render ENV changes are required. No Firebase Rules update is required.

Use:
- Selling Price / Final Price: actual payment price, e.g. RM20
- Promo Original Price: optional old price, e.g. RM30

Public card display will show RM30 crossed out → RM20 with a Save % badge.


## (274)-AZOBSS-PROMO-BADGE-OLD-PRICE-BIGGER-FIX_20260622
- Enlarged the crossed original promo price text (example: RM30) so it is clearer on mobile.
- Kept the promo badge compact at the top-left and avoided product logo overlap.
- Final selling price remains only inside the Buy Now button.
- No changes to PA/BM, My Purchases, Cart/Like/Bell/Message badge, Firebase Rules, or Render ENV.


### Patch (275)
Promo badge old-price strike line is lighter/transparent for better readability. No Render ENV or Firebase Rules update required.


## AZOBSS Patch 276 - Promo Badge Diagonal Strike Fix
- Old promo price line is now diagonal/slanted and semi-transparent for better readability.
- Applies to Software Tools and CAD Tools only.
- No Firebase Rules or Render ENV changes required.


## (291) Shop Card Mobile Footer Visible Fix
- Fix mobile product card after (290): downloads/rating footer now stays inside normal card flow and is visible.
- Keeps single clean merged stats script from (290).
- Keeps Like / Share / Preview GIF / More / Buy Now visible from first paint.
- Does not touch PA/BM flow, My Purchases, Cart storage/payment, Bell/message badge, Firebase Rules, or Render ENV.
