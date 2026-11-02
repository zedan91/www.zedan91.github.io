# AZOBSS v1493 — PC Build Cart/Buy + Exact Image Hardening

Baseline: v1492 FULL WEBSITE (AZOBSSTV removed)
Date: 2026-11-03

## Customer-facing fixes
- PC Builds with one clear numeric price now show Add to Cart and Buy Now again.
- Live-verified PC Builds can proceed with the current confirmed price.
- Clear-price snapshot PC Builds can also enter cart / Buy Now, but checkout creates a Price Confirmation order first; invoice/payment stays locked until admin confirms price.
- Hardware clear-price snapshot items use the same Price Confirmation safety flow instead of being WhatsApp-only.
- Cart now supports mixed Hardware + PC Build items.
- PC Build cards keep Salin Spec, Share, and Tanya / Tempah.

## Image accuracy fixes
- Exact-image matching now requires stronger product/model identity evidence.
- Conflicting CPU/GPU images are rejected (e.g. an i3 card cannot accept an i5 + RTX 5060 image).
- Added Shopify predictive-search image resolver for supported retailers.
- Added WooCommerce Store API image resolver for Ideal Tech.
- Existing collection/listing/lazy-image/Markdown resolvers remain as fallbacks.
- No AI/generic PC image fallback is introduced.

## Checkout/order lifecycle
- Snapshot/clear-price products are accepted into checkout as requiresConfirmation=true.
- Backend revalidates current Hardware and PC Build catalogs before order creation.
- If any item is not live-confirmed, status becomes price-confirmation and no invoice is issued yet.
- Live-confirmed items retain the existing direct flow, subject to courier confirmation.
- Courier address validation, duplicate guard, Maybank-only flow, and Sales & Receipts integration remain intact.

## Verification
- 348/348 regression tests passed.
- 98/98 JavaScript files passed node --check.
- 141/141 JSON files parsed successfully.
- 554/554 inline HTML scripts passed syntax checking.
