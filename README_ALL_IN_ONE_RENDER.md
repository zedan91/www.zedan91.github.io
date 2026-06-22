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


## AZOBSS Patch 281 - Shared Link Instant Controls No Blink
- Software/CAD shared product links now show Like, Share, Preview GIF, rating and download stats immediately.
- Removed the shared-link control hiding/skeleton wait that made controls appear late.
- Seeded stable card controls in the initial card HTML, then later scripts update state silently in-place.
- Patched like button binding so pre-rendered Like buttons still work.
- Does not touch PA/BM flow, My Purchases, Cart/Bell/Message badge logic, Firebase Rules, or Render ENV.
