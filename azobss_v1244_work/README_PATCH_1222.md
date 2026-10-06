# AZOBSS v1222 — PA/BM & Lot Kadaster Payment `trustedResolved` Fix

## Fixed
- Fixes checkout failure on `/PA-BM/` / Lot Kadaster purchases that showed `trustedResolved is not defined`.
- Root cause: the PA/BM ToyyibPay bill builder accidentally referenced `trustedResolved.account`, a variable that only exists in the separate digital-product checkout flow.
- PA/BM checkout now resolves `billPhone` only from the PA/BM customer payload (`user.phone`, `buyerPhone`, or `phone`) and no longer touches the digital-product resolver.
- No pricing, discount, lot selection, purchase-record, download, AZDM, or Cloudflare Worker behaviour is changed.

## Deployment
Deploy the full package to the existing AZOBSS Render/website deployment. No AZDM Cloudflare Worker update is required for this patch.
