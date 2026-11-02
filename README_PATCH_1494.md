# AZOBSS v1494 — Clean Product Image Crop + Fullscreen Zoom

Based on v1493.

## Changes
- Retailer-aware clean crop profiles for product imagery.
- Stronger rejection of banner/promo/header/voucher imagery in the image resolver.
- ALL IT, Jayacom, Ideal Tech, Viewnet and Tech Hypermart use stronger edge crop; other common retailers use moderate crop.
- Crop profile is preserved when opening the large image viewer, so hidden retailer price/logo margins do not reappear.
- Dedicated fullscreen image lightbox up to 98vw / 94vh.
- Click/tap image inside lightbox toggles extra zoom.
- Hardware and PC Build image click both use the same dedicated viewer.
- v1493 cart, Buy Now, Price Confirmation and AZOBSSTV removal remain unchanged.

## Verification
- npm run verify passes.
- 351/351 regression tests pass.
- 98/98 JavaScript files parse.
- 141/141 JSON files parse.
- 558/558 inline scripts parse.
