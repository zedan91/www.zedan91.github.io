Deploy as usual to GitHub Pages / Render static project. No new server environment variables required.


## (254) Staff Own-Record Scoped Query Fix
Deploy as usual. No Render ENV change required. No Firebase Rules update required for this patch.

## Patch 265 - Software/CAD Promotional Price Discount Display Fix
Deploy normally. No Render ENV changes are required. No Firebase Rules update is required.

Use:
- Selling Price / Final Price: actual payment price, e.g. RM20
- Promo Original Price: optional old price, e.g. RM30

Public card display will show RM30 crossed out → RM20 with a Save % badge.


## AZOBSS Patch 271 - Promo Badge Readable Text Fix
- Enlarged top-left promo badge text for old price and Save percentage.
- Kept final sale price only inside the Buy Now button.
- Applied to Software Tools and CAD Tools.
- No changes to PA/BM flow, My Purchases, Cart/Like/Bell/Message badge, Firebase Rules, or Render ENV.
