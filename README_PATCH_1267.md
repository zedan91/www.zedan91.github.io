# AZOBSS v1267 — Cart Selection Highlight Hard Fix

## Issue
Add to Cart works, but the clicked cart icon in PA/BM result tables may not remain visually highlighted. The highlight state was owned only by the ES-module storefront. The classic inline cart core (the reliable Add-to-Cart path since v1259) updated the cart but did not own table-button visual state, so when the storefront module was late/unavailable the cart changed while the icon stayed blue with `+`.

## Fix
- Classic cart core now synchronizes every PA/BM/SBM/GPS/Syit table cart button against the actual cart IDs.
- Selected items receive `.is-in-cart`, `aria-pressed=true`, `data-cart-selected=1`, green highlight and check mark.
- Removing an item clears the highlight immediately.
- MutationObserver syncs buttons added later by search/pagination.
- Existing cart items are highlighted after reload/recovery too.
- Storefront CSS cache query bumped to v1267 to force the already-defined `.is-in-cart` visual rules to refresh.
- Payment, server cart persistence/recovery, pricing and search logic are otherwise unchanged from v1266.
