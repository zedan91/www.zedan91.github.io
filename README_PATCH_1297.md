# AZOBSS Patch 1297 — Shopee Browser Resolver Fallback

Date: 2026-10-12
Package: 1.0.1297
Baseline: v1296

## Fix

- Keeps the existing direct Shopee short-link/metadata resolver.
- When direct metadata is incomplete or blocked, launches system Chromium through `puppeteer-core`.
- Renders the Shopee page, follows the affiliate short-link, observes Shopee JSON product calls and retries product APIs from the browser session with cookies.
- Extracts rendered title, image, price hints, description, shop/rating/sold data and merges them with HTTP metadata.
- Adds a 6-hour in-memory metadata cache and in-flight de-duplication.
- Manual `Import / Retry` bypasses cache; automatic paste uses cache when available.
- Affiliate short link remains the customer `Buy Now` URL.
- Open API remains preferred once Shopee approves credentials.

## Runtime

Production remains `node deploy-server.js`. The Docker image already installs Debian Chromium, so no new browser binary package is required.
