# AZOBSS v1305 — Shopee Reader Egress Fallback

## Why v1304 still failed
The v1304 SEO parser was correct when Shopee returned a traffic-challenge page containing product `<head>` metadata. Render can receive a harder datacenter block before that useful HTML is returned, so there may be nothing for v1304 to parse.

## v1305
- Native Shopee HTTP/SEO remains first.
- If no real title is recovered, AZOBSS tries Jina Reader (`https://r.jina.ai/`) using only the public Shopee URL.
- No Shopee cookies, browser Authorization headers, AZOBSS admin credentials, or private session values are forwarded.
- Reader JSON/markdown is normalized into the existing minimal contract: title required; description/image/price optional.
- If Reader recovers title, Chromium is skipped to reduce delay. Chromium remains the final fallback only when the title is still missing.
- Existing affiliate `s.shopee.com.my` URL remains the Buy Now URL; recovered canonical URL is metadata identity only.
- Optional env: `AZOBSS_SHOPEE_READER_ENABLED=0` disables Reader. `JINA_API_KEY` or `AZOBSS_JINA_API_KEY` can raise Reader limits but is not required for basic anonymous use.
- Failure JSON now includes safe `attempts` diagnostics without secrets.

## Files
- `deploy-server.js`
- `backend/server.js`
- `affiliate-shop/index.html`
- `assets/js/azobss-global-auth.js` + cache busters
- `package.json`
- `tests/shopee-reader-fallback-v1305.test.cjs`
