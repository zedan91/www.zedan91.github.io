# AZOBSS v1303 — Shopee Minimal Product Contract

Date: 2026-10-13
Package: 1.0.1303
Baseline: v1302

## Why
Public frontend study of ViralKaya showed its useful product resolver treats `title` as the required field while `description`, `image`, and especially `price` are optional. A missing price must not make a valid product import fail.

## Changes
- Title is now the hard requirement for successful automatic Shopee metadata import.
- Description, image and price are optional enrichment fields. Missing price never displays as RM0.
- Browser fallback always runs when the title is missing, regardless of other metadata score.
- Successful responses expose a small product contract: `title`, `description`, `image`, nullable `price`, and `sourceUrl`.
- Original affiliate short URL remains separate as `affiliateUrl` and is always the customer Buy Now link.
- `sourceUrl` is the canonical/resolved Shopee product URL when available.
- Partial success includes `missing[]`; Admin can fill optional fields manually without treating the import as failed.
- If title is still unavailable after HTTP + browser attempts, response uses `SCRAPE_FAILED` but preserves affiliate URL plus any resolved IDs/canonical URL for manual continuation.
- Canonical `...-i.<shopId>.<itemId>` URL slug can be used as a conservative last-resort product title.
- Existing v1302 anti-garbage protections remain active.

## Important
This patch does not call or reuse ViralKaya private server endpoints, credentials, cookies, or tokens. It only applies the observed public product-contract behavior to AZOBSS's own resolver.
