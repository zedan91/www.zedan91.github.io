# AZOBSS v1483 — Exact Product Media + Detailed Verified Specs + Hover Zoom

## Customer-facing policy
- PC Builds are shown only when current price, availability, exact product-page media and detailed specifications are verified against the same official product page.
- Generic/reference/assumed PC images are not shown.
- If an exact image fails to load, the product card is removed rather than replaced by a generic fallback.
- Product images zoom automatically on hover for desktop pointer devices.
- Source branding around a product photo is visually cropped/focused with CSS only; the source image itself is not AI-edited or altered.

## Verified PC Builds in this release
- DOTATECH FA-GAMING R5 official page, the default RX7600 configuration: RX 7600 8GB, RTX 5060 8GB, RTX 5060 Ti 16GB.
- Detailed CPU / GPU / motherboard / RAM / storage / case / PSU / OS rows come from the same official product page.

## Hardware Shop
- MSI GeForce RTX 5070 12G VENTUS 2X OC — exact NB Plaza product page/image/spec.
- MSI MAG B860M MORTAR WIFI — exact NB Plaza product page/image/spec.
- MSI RTX 5060 INSPIRE is removed because the official retailer lists it Out-of-Stock.
- Fresh official verification can be used for up to 48 hours when live scraping is blocked; it is labelled `verified`, not `live`.

## Preserved
- v1482 retailer-only PC Builds and seller-prefix cleanup.
- v1481 modal/cart recovery.
- v1480 pagination/performance and strict-price flow.
- v1479 Order → Confirm Price → Invoice, courier address validation and duplicate-order protection.

## Strict configurable-product rule
Only the exact default RX7600 configuration is customer-visible for DOTATECH FA-GAMING R5. Other GPU variants are not duplicated from the same source image, avoiding any visual/spec assumption.
