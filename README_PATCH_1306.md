# AZOBSS v1306 — Shopee Reader Generic Title Rejection + Canonical Retry

v1305 proved Reader egress works, but the live Render runtime accepted a generic landing title such as `Shopee Malaysia | Free Shipping Across Malaysia` as the required product title. That false positive stopped the resolver before Chromium.

## Changes
- Reject generic Shopee landing titles in the actual `deploy-server.js` runtime and the Express mirror.
- Expand generic patterns including `Shopee Malaysia | ...`, `Malaysia | Free Shipping ...`, and similar landing titles.
- Reader searches markdown Title/Product Name/H1/canonical-link text and URL slug for a real product title.
- Reader decodes percent-encoded/challenge `next=` URLs and recovers shop/item identity where possible.
- If first Reader pass discovers a canonical product URL but no real title, run one second Reader pass on that canonical URL.
- If Reader still has only image/generic title, reject it so Chromium runs instead of returning false success.
- Metadata merge strips generic titles while keeping useful image/canonical fields.
- Frontend guard prevents stale backends from auto-publishing a generic Shopee title.
- Affiliate short URL stays unchanged as Buy Now. Price/description/image remain optional once a real title exists.
