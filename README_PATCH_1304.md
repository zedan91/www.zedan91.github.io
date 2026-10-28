# AZOBSS v1304 — Shopee Challenge-Page SEO Metadata Resolver

Package: 1.0.1304

## What changed
- Adds an SEO-first Shopee metadata resolver before internal `/api/v4/...` calls.
- Accepts useful product metadata even when Shopee lands on `/verify/traffic/error`.
- Recovers the real product URL from `<link rel="canonical">`, `og:url`, or the challenge `next=` parameter.
- Extracts `og:title`, description, `og:image`, and canonical source URL.
- Removes the `| Shopee Malaysia` suffix from the product title.
- Keeps price optional; missing price does not fail import.
- Preserves the original affiliate short-link separately for Buy Now / commission tracking.
- Chromium and Shopee internal API calls remain fallback-only when a real title is still missing.
- Adds `seoRecovered` and challenge-aware source diagnostics to the metadata endpoint.

## Evidence behind this patch
A controlled browser/HAR comparison showed that Shopee traffic-verification pages can still expose the real product canonical URL, title, description and image in SEO tags. The metadata returned by the reference resolver matched those tags while price remained unavailable. v1304 therefore reads useful SEO metadata before treating a challenge page as a failure.

## Safety
Only Shopee Malaysia hosts are accepted. Challenge `next=` destinations are decoded and revalidated with `azShopeePublicHost()` before use. No ViralKaya cookies, authorization tokens, private endpoints or credentials are used.
