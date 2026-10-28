# AZOBSS v1302 — Shopee Product Metadata Accuracy Fix

Date: 2026-10-12
Package: 1.0.1302
Baseline: v1301

## Root cause
Shopee affiliate redirects can land on `/openapp/<shopId>/<itemId>`. v1301 did not treat that path as a product identity. The generic embedded-state parser could therefore read unrelated application keys such as `shopee_language` and `shopee_mart` as a product title/shop.

## Fix
- Detect `/openapp/<shopId>/<itemId>` as Shopee product identity.
- Normalize openapp landings to canonical `/product/<shopId>/<itemId>` before product metadata extraction.
- Scope embedded JSON/state extraction to the confirmed item only.
- Reject obvious Shopee internal tokens as title/description/shop metadata.
- Make metadata completeness quality-aware so junk text cannot prevent browser fallback.
- Preserve the original affiliate short link as the customer Buy Now URL.

Regression sample: `/openapp/1788321926/55218001609` → shop `1788321926`, item `55218001609`.
