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
