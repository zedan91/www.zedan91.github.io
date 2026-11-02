# AZOBSS v1487 — Restore broad clear-price PC catalog

## Why
v1484-v1486 made live verification a hard gate. When retailer HTML/anti-bot parsing failed, valid priced products disappeared and the PC Build page could show almost nothing. The intended rule is narrower: remove products with no price, unclear/range price, or confirmed unavailable products — do not remove clear-price products merely because live sync temporarily fails.

## v1487 behavior
- Restores 111 retailer PC products that have one clear numeric source price.
- Removes 10 legacy ALL IT records whose source data is a price range rather than one exact price.
- Exact live retailer mappings remain active as an enhancement: when live verification succeeds, current price, stock, exact image and live specs replace the snapshot card.
- Confirmed OOS exact matches are hidden.
- Temporary live sync/parser failure does not erase clear-price cards.
- Generic AZOBSS PC illustrations are not reused as product photos. If no exact photo is verified, the card says the image is not yet verified.
- Public PC Build cards expose final selling price only; source cost/markup remains backend-side.
- Hardware Shop may show a fresh clear-price snapshot when live sync is temporarily unavailable, but Add to Cart / Buy Now remains live-only. Snapshot hardware uses Tanya / Tempah.
