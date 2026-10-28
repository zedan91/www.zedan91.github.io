# AZOBSS v1334 - Affiliate Shop Marketplace Card Redesign

- Cancels/removes the v1331 hover image zoom feature completely.
- Replaces Affiliate Shop product cards with a compact marketplace-style layout based on the supplied reference: large product image, two-line title, short description, See More when needed, prominent price, rating, rating-count, sold-count, source/shop and Buy Now.
- Keeps fixed/equal card heights so long descriptions do not stretch individual cards.
- Preserves v1333 local Affiliate Shop bookmark filter, v1332 trust notice, v1330 description modal scroll lock, and v1328 strict Firestore import flow.
- Normalization/import now retains price_myr, rating_count and historical_sold when those fields are available in future Shopee JSON imports. Missing commercial metrics are shown as unavailable rather than invented.
