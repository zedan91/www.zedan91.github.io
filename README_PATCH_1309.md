# AZOBSS v1309 — Shopee Local Browser Capture Bridge

- Keeps the v1308 server resolver as first attempt.
- Adds a local browser extension bridge for cases where Shopee blocks Render/cloud automation.
- The extension reads only product SEO metadata already available in the user browser.
- Fixes the old extension generic-title bug: legitimate product titles ending in `| Shopee Malaysia` are now stripped and accepted instead of rejected.
- Captures canonical URL, title, description, image, shopId and itemId.
- Stores the capture in extension local storage and bridges it into `/affiliate-shop/`.
- AZOBSS auto-opens the Edit Item / Card modal with captured fields while keeping the pasted `s.shopee.com.my` affiliate link as the final Buy Now URL.
- Server failure no longer creates a fake `Shopee Product` placeholder; the UI directs the admin to Browser Capture instead.
- No Shopee cookie, login credential, Authorization header or session token is exported.
