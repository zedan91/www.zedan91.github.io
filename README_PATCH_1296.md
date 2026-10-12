# AZOBSS Patch 1296 — Shopee Runtime Route + Resolver V2

## Root cause fixed
Render production starts `deploy-server.js`, but v1293-v1295 Shopee API routes existed only in `backend/server.js`. Therefore the live frontend could receive a missing-route response even though the importer code existed in the package.

## Changes
- Ports `/api/shopee-affiliate/status`, `/generate-link`, `/product-offers`, and `/product-metadata` into the actual `deploy-server.js` runtime.
- Keeps the routes Admin-only using the existing verified Firebase admin identity.
- Adds rate limiting for metadata import.
- Adds short-link resolver V2: HTTP redirects, meta-refresh, JS redirects, universal/deep-link extraction, encoded Shopee URLs, and item/shop ID recovery from page HTML.
- Adds multi-source metadata: page meta, JSON-LD, embedded page state, item API, PDP API.
- Preserves the original affiliate short link as the Buy Now URL.
- Adds Shopee Open API env placeholders to root `render.yaml` for later approval.
