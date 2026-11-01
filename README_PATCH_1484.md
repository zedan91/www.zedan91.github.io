# AZOBSS v1484 — Strict Live Verification, Cart Hardening & Private Pricing

## Baseline
Built from v1483 FULL WEBSITE. This is a full root-ready release.

## PC Build & Hardware fixes
- Hardware is customer-visible only when backend verification returns a positive live price and explicit `available` stock state.
- `unknown` availability is never treated as available.
- Out-of-stock/unverified products are hidden and rejected by checkout.
- Checkout forces a fresh live catalog revalidation before duplicate-order reuse or order creation.
- Stale cart items are removed against the current live catalog; backend remains the final authority.
- Buy Now uses a temporary single-item checkout and does not mutate or checkout the existing cart.
- Courier still requires a delivery address at frontend and backend.
- Deferred invoice lifecycle from v1479 remains: Order -> price/shipping confirmation -> Invoice -> Receipt.

## Retailer PC Builds
- Public PC Builds are served by `/api/pc-shop/builds` after backend live verification.
- Static retailer JSON no longer contains source/selling prices, costs or markup.
- Only rows with exact source URL, exact media, exact specs, exact variant and verified availability can become live candidates.
- Source/store remains visible to customers, while retailer/store prefixes stay removed from product names.
- PC Builds are enquiry/browse items and are not silently resolved from old snapshots during hardware checkout.

## Pricing privacy
- Public PC JSON files contain no `marketPrice`, `snapshotPrice`, `unitCost`, `cost`, `markupRate`, `markupAmount`, `marketDelta` or `liveMarketDelta` fields.
- Public Build Sendiri is quote-only and shows no hidden admin cost/markup in browser DOM/spec output.
- Public `/api/pc-build/full-catalog`, `/api/pc-build/live-prices`, and `/api/pc-build/custom-market` are sanitized.
- Full pricing variants are available only under protected `/api/admin/pc-build/*` routes.

## Image reliability and UX
- Exact-source images are proxied through the AZOBSS backend with an in-memory verified image cache.
- Invalid/non-image responses are rejected.
- Product images support desktop hover zoom and tap/click image viewer.
- Image/source mismatch fallback to generic PC artwork remains disabled.

## Admin/auth/order hardening
- PC Build admin pricing no longer relies on localStorage role detection.
- Customer order queries prefer `orderBy(createdAtMs, desc)` with a safe fallback where Firestore indexing requires it.
- Admin order list is newest-first.
- Duplicate order protection is retained but only after current live product validation.
- Old PC Shop JS/CSS/admin runtime copies were removed so v1484 has one active PC Shop owner.

## Version/cache consistency
- `package.json`: `1.0.1484`
- Administrator visible release badge: `v1484`
- Shared auth and long-session cache-bust references updated to v1484 across production HTML.
- Active PC Shop assets: v1484 only.

## Verification
- `npm run verify`: PASS
- Regression tests: 337/337 PASS
- JavaScript syntax: 100/100 PASS
- JSON parse: 163/163 PASS
- Inline HTML scripts: 556/556 PASS
- Public PC pricing-secret scan: PASS
- Old PC Shop runtime reference scan: PASS
- Private-key marker scan: no embedded private key found

## Deployment
Archive contents are directly at repository root (`index.html`, `backend/`, `lib/`, `assets/`, `PC-Build/`, etc.). No parent wrapper folder and no manual merge is required.
