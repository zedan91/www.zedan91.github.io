# v1496 — Canonical Retailer JSON Catalog

## Purpose
v1496 replaces fragile runtime image guessing with a structured retailer catalog pipeline.

## Data policy
- Official retailer source preferred.
- Exact product URL and exact image URL are stored together when verified.
- `dataLevel=exact` means the data came from an individual product record/page.
- `dataLevel=listing` means only collection/listing data is known; listing images are not trusted automatically.
- `dataLevel=snapshot` is the old clear-price fallback and never becomes checkout-ready by itself.
- Unknown stock is not treated as in stock.
- No generic/AI product image is invented.
- Store name stays separate from product title.

## Sources configured
DOTATECH, EMARQUE, ALL IT Hypermarket, Brightstar Computer, Ideal Tech, ILLEGEAR, NB Plaza, Tech Hypermart, Viewnet. Jayacom is disabled from verified live refresh until an official product source is available.

## Runtime
- Public: `GET /api/pc-shop/retailer-catalog` — sanitized catalog with AZOBSS selling prices, images/specs and no raw source cost/markup fields.
- Admin: `GET /api/admin/pc-shop/retailer-catalog` — full canonical catalog.
- Admin refresh: `POST /api/admin/pc-shop/retailer-catalog/refresh`.
- Image proxy: `/api/pc-shop/retailer-image/:id`.
- Fast refresh for Shopify/WooCommerce sources starts automatically after backend boot.

## Manual JSON refresh
`npm run catalog:refresh -- --output /path/to/catalog.json`

The raw generated JSON should not be committed to the public GitHub Pages root if source prices are intended to remain private.

## Web enrichment completed after initial build
The timeout-safe continuation added `PC-Build/catalog/v1496/web-enriched-current.json` as a higher-freshness bootstrap layer.

Current bootstrap coverage:
- 228 canonical records total
- 63 exact product records
- 62 records with an exact/known image URL
- 60 newly web-enriched exact records from official retailer pages:
  - DOTATECH: 32
  - EMARQUE: 28

The frontend now loads the canonical retailer JSON first. A failure in the legacy/live sync no longer clears the already-loaded JSON catalog.

Exact data is never fabricated: other retailers remain `listing`/`snapshot` until an exact product page and image can be matched safely. The backend refresher can promote them later when the official endpoint/page is readable.
