# AZOBSS v1294 — Shopee Manual Get Link + Save & Publish

## Baseline
Built from AZOBSS v1293.

## Purpose
Use Shopee Affiliate on AZOBSS immediately while the Shopee Open API application is still pending.

## New manual flow (works without App ID / Secret)
1. Admin opens **Shopee Product Offer / Get Link**.
2. Click **Open Shopee Product Offer**.
3. In Shopee, select a product and use **Get Link**.
4. Paste the resulting `https://s.shopee.com.my/...` link into AZOBSS.
5. Click **Add to AZOBSS**.
6. Complete/edit product name, price, image and press **Save & Publish**.
7. Customer **Buy Now** uses the saved affiliate tracking link directly.

## Safety
- AZOBSS detects `s.shopee.com.my` / `shope.ee` affiliate links.
- A normal Shopee product URL is blocked from being published as a Shopee Buy Now link so it is not accidentally saved without affiliate tracking.
- Existing v1293 Open API integration remains intact. When Shopee approves App ID + Secret, Product Offer search and Auto Get Link become available again without migrating existing products.
- API status is checked when the Shopee panel opens; manual mode remains available even if the API is unavailable.

## Open API (future)
No Render Shopee credential is required for the manual flow. When approved, use the same v1293 environment variables:
```
SHOPEE_AFFILIATE_APP_ID=...
SHOPEE_AFFILIATE_SECRET=...
SHOPEE_AFFILIATE_ENDPOINT=https://open-api.affiliate.shopee.com.my/graphql
```
