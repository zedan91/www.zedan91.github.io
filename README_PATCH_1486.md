# AZOBSS v1486 — Live Source Parser Recovery

Baseline: v1485 FULL.

## Fixes
- Reader/Jina Markdown fallback now recovers product title and exact product images instead of requiring HTML og:image.
- Shopify products with multiple variants select the URL-pinned variant, keyword variant, or first currently available variant; selected variant is disclosed.
- PC Build specifications are extracted from the live source page (CPU, GPU, motherboard, RAM, storage, PSU, cooler, case, OS) rather than stale static parts.
- PC Build identity is checked against the exact source URL/model token to reject generic redirects/pages.
- Public PC cards no longer reuse stale best-for/software/resolution assumptions; filters use CPU/GPU metadata derived from live specs.
- NB Plaza exact product pages have category/listing fallback for live price/stock when datacenter access is blocked.
- Empty live catalog cache expires after 10 seconds instead of 10 minutes; customer UI retries once automatically and Hardware provides a manual Retry button.
- Availability remains strict: unknown/out-of-stock/pre-order-only items are not purchasable.
- Existing v1485 cart/checkout/privacy/order protections retained.
