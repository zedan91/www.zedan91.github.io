# AZOBSS v1293 — Shopee Affiliate Product Offer + Auto Get Link

## Baseline
Built from AZOBSS v1292.

## What changed
- `/affiliate-shop/` Admin gets a new **Shopee Product Offer** button.
- Product Offer search is loaded through the official Shopee Affiliate Open API (`productOfferV2`).
- `Add to AZOBSS` prefills title, image, price, shop/sales/rating metadata and uses Shopee `offerLink` as the customer **Buy Now** link.
- Add/Edit Item now has **Original Shopee Product Link** + **Auto Get Link**.
- If an original Shopee product URL is present when Save Product is pressed, AZOBSS automatically calls backend `generateShortLink` and stores the resulting affiliate short link before saving.
- Existing affiliate short links (`s.shopee.com.my` / `shope.ee`) are preserved.
- Added optional product image support on affiliate cards.
- Shopee App ID/Secret stay on backend only; they are never embedded in customer HTML.

## Render ENV required for full automation
```
SHOPEE_AFFILIATE_APP_ID=YOUR_APP_ID
SHOPEE_AFFILIATE_SECRET=YOUR_SECRET
SHOPEE_AFFILIATE_ENDPOINT=https://open-api.affiliate.shopee.com.my/graphql
```

Without the Open API credentials, Admin can still use **Open Shopee Product Offer** and paste the manually generated affiliate link into the final link field.

## New backend routes
- `GET /api/shopee-affiliate/status` (Admin)
- `POST /api/shopee-affiliate/generate-link` (Admin)
- `GET /api/shopee-affiliate/product-offers` (Admin)
