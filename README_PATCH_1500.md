# AZOBSS v1500 — Exact Shopify Product Image Fix

## Problem fixed
Hardware Shop could show a retailer promotion/banner instead of the exact product image for Shopify products (seen on ALL IT items such as DeepCool CC310 and Cooler Master QUBE 540). The fallback path could use page-level `og:image`, which may be a campaign banner rather than the product gallery image.

## v1500 fix
- `backend/server.js` now returns the exact Shopify product/variant image from `/products/<handle>.js` (`variant.featured_image`, `product.featured_image`, or `images[0]`) together with live price/stock.
- The local image preparer now discovers catalog Shopify products that previously had `image: ""` by reading the exact product JSON endpoint.
- Discovered exact images are downloaded into `PC-Build/images/products/` and mapped by product ID and exact product name.
- Existing v1499 local images are reused; valid files are not downloaded again.
- Local mode remains strict: once prepared, mapped hardware/PC Builds use the website's local image files instead of retailer hotlinks.

## Upgrade from v1499
1. Extract the v1500 merge patch over the current v1499 website folder and replace files.
2. Keep the existing `PC-Build/images/products/` image files.
3. Run `PREPARE-LOCAL-PC-IMAGES.bat`.
4. The script keeps existing valid images, discovers missing exact Shopify images, downloads them, validates them, regenerates the local map, and creates the v1500 deploy ZIP.
5. Deploy frontend and backend/Render changes.

## Verification
`npm run verify`: 365/365 tests passed.
