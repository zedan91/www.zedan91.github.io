# (443)-AZOBSS-BOOKMARKS-HIDE-CART-FOR-FREE-SOFTWARE-FIX

Patch 443 changes the Bookmarks page so the Add to Cart button only appears for paid/premium Software/CAD bookmarks.

## Changes
- Free Software bookmarks no longer show the Add to Cart button.
- Future saved bookmarks now store product type/price hints (`free` / `premium`) so Bookmarks can decide correctly.
- Existing old Software bookmarks with no premium/paid marker will not show Add to Cart, preventing free items from being added to cart incorrectly.
- Premium items with price/payment metadata can still show Add to Cart.
- Cache version bumped to `v=443`.

## Deploy
- Frontend/GitHub Pages only.
- No Firebase Rules update required.
- No Render backend deploy required.
