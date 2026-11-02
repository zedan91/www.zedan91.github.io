# AZOBSS v1495 — Full Image Text/Price Cleanup (No Crop)

- Reverts v1494 visual crop/scale behavior: product images are always shown full with `object-fit: contain`.
- Retailer store-name/original-price cleanup is performed at the backend image proxy on narrow edge text zones only; image dimensions are unchanged.
- Promotional/banner images remain rejected by the exact-image resolver.
- Fullscreen viewer remains available and click/tap zoom remains enabled.
- Built on v1494; cart/checkout, PC Build ordering, Promosi Bisnes and AZOBSSTV removal remain unchanged.
