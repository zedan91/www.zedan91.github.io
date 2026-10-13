# AZOBSS v1308 — Shopee Short-Link Redirect-Chain Browser Recovery

- Adds a dedicated **mobile Chromium redirect-chain resolver** before Reader fallback.
- Observes Shopee navigation requests, response URLs, `Location` headers, challenge `next=`, document HTML and `CONFIG.httpUrl`.
- Ranks recovered destinations and normalizes confirmed shop/item IDs to a canonical Shopee product URL.
- If a canonical slug contains the product name, uses that real slug title as the minimal required title.
- Reader then retries using recovered canonical instead of the affiliate short link whenever possible.
- Final Chromium product-page fallback now reports whether it completed but still received a Shopee verification/generic title.
- Affiliate short link remains the final **Buy Now** link for commission tracking.
- No Shopee cookies, user credentials or ViralKaya endpoints are used.
