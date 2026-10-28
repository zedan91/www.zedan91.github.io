# AZOBSS v1307 — Shopee Short-Link Destination Recovery

v1306 correctly rejected generic Shopee titles, but some affiliate short links still failed before a canonical product URL was discovered. v1307 strengthens the short-link resolution stage before Reader/Chromium.

## Changes
- Mobile-style HEAD redirect probe for `s.shopee.com.my`.
- Parse JavaScript `CONFIG.httpUrl` / `httpUrl` destinations from Shopee short-link landing HTML, including JS escapes and percent encoding.
- Expand safe nested Shopee redirect keys while keeping every destination restricted to Shopee Malaysia hosts.
- Reader supports up to three public-URL passes and the same `httpUrl` recovery.
- Reader and Chromium prefer a recovered canonical product URL instead of repeating the blocked short link.
- Live Render failures return safe `http` / `jina-reader` / `browser` attempt diagnostics to the existing Admin UI. No cookies, authorization headers, or secrets are returned.
- Affiliate short URL remains the Buy Now link.
