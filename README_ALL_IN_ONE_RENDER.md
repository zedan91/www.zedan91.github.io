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
