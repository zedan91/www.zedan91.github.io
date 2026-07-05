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
