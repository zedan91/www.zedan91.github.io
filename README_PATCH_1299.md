# AZOBSS v1299 — Shopee Server-side Canonical Resolver

Date: 2026-10-12
Package: 1.0.1299
Baseline: v1298

## Changes

- Reworks Shopee product import around a backend-first flow: the frontend sends the affiliate URL, the AZOBSS server resolves the real Shopee product, then returns metadata.
- Adds direct decoding for Shopee MY tracking landing parameters such as `origin_link` before metadata scraping.
- Keeps the original `s.shopee.com.my` / `shope.ee` affiliate link untouched as the customer **Buy Now** URL.
- Separates the resolved product URL and product identity (`shopId`, `itemId`) from the affiliate URL.
- Direct HTTP resolver runs first; Chromium browser resolver remains the fallback when Shopee blocks or omits server-side metadata.
- Price is optional. Name/image/description can still be imported even when Shopee does not expose a price.
- Frontend status now shows the resolved shop/item identity and warns only the missing price can be filled manually.
- Runtime diagnostics now report patch `1299`; administrator-only website version badge is updated to `v1299`.

## Security

- Decoded destinations are followed only when they remain on Shopee Malaysia hosts.
- The customer affiliate URL is never replaced by the canonical product URL.
- No third-party private API, cookie, token, secret, or proprietary endpoint is reused.
- Shopee Affiliate Open API secret remains backend environment-only.
