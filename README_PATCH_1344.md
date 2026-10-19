# AZOBSS v1344 — Upgrade & Parts automatic online market pricing

- Upgrade & Parts no longer depends only on hard-coded component prices.
- Public page calls `https://azobss-backend.onrender.com/api/upgrade-parts/live-prices`.
- Backend reuses existing Shopee Affiliate Open API credentials and queries live Malaysia product offers for RAM, NVMe SSD, GPU, PSU, laptop batteries and laptop adapters.
- Live results are filtered by product title and sanity price bounds, then converted into trimmed market ranges (20th–80th percentile) to reduce extreme/outlier listings.
- 6-hour cache by default; stale public requests refresh automatically, and Express backend also runs a six-hour cron while awake.
- Cache may be persisted in Firestore at `settings/upgradePartsLivePrices` when backend Firestore is available.
- If Shopee API/source fails, the last cached live result is used; if no cache exists, v1343 fallback estimates remain so the page never becomes blank.
- Browser receives only aggregate ranges. Shopee App Secret remains server-side.
- Live status badge shows live/fallback state and last update time.

Required existing Render ENV (already used by AZOBSS Affiliate Shop):
- `SHOPEE_AFFILIATE_APP_ID`
- `SHOPEE_AFFILIATE_SECRET`
- `SHOPEE_AFFILIATE_ENDPOINT=https://open-api.affiliate.shopee.com.my/graphql`

Optional:
- `UPGRADE_PRICE_CACHE_MS` (default 21600000 = 6 hours)
- `UPGRADE_PRICE_SAMPLE_LIMIT` (default 20)
