# AZOBSS v1295 — Shopee Affiliate Auto Product Info Import

Baseline: v1294.

## New flow without Shopee Open API
1. Admin opens Shopee Product Offer and obtains the affiliate Get Link (`s.shopee.com.my`).
2. Paste the affiliate link into AZOBSS.
3. AZOBSS automatically resolves the short link on the backend and attempts to read public Shopee product metadata.
4. Product form is auto-filled with product name, image, description, price/price range, seller/rating/sold information when available, and the original product URL.
5. The affiliate Get Link remains the final Buy Now URL. Admin normally only needs to press **Save & Publish**.

## Fallback
Shopee may block or limit public metadata requests from server/data-center IPs. If that happens, the affiliate link remains valid and the existing manual form remains available. Open API automation from v1293 is preserved for future use after approval.

## Security
The metadata endpoint is Admin-only and only follows Shopee Malaysia hosts, preventing arbitrary server-side URL fetching.
