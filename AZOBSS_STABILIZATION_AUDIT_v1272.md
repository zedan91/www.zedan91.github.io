# AZOBSS Full Stabilization Audit — v1272

Baseline: v1271.

## Main stabilization changes

1. **Authentication / navbar / purchase records single owner**
   - `azobss-global-auth.js` is the canonical runtime.
   - 24 pages no longer load the legacy 6,471-line combined `azobss-firebase-live-likes-sync.js`.
   - Those pages now load `azobss-live-likes-only.js`, which contains bookmarks/likes only and does not assign auth/cart/purchase globals.

2. **PA/BM cart single normal owner**
   - Inline classic cart core remains the normal owner: `classic-core-v1272`.
   - Storefront no longer replaces `window.azobssAddToPaBmCart` / `window.azobssRecordPurchase` during normal startup.
   - Storefront only takes emergency cart ownership if the classic core failed to initialize.
   - Configured-product and prepared Lot Kadaster additions delegate to the canonical cart core.

3. **Checkout ownership stabilized**
   - Storefront remains the normal checkout owner.
   - Secure global-auth fallback remains only for the gap before storefront binding.
   - Admin Test Payment secure fallback from v1270 is preserved.

4. **Lot Kadaster map single click owner**
   - `azobss-pabm-early-bridge.js` is the only click owner for `[data-jupem-lot-map]`.
   - The duplicate storefront map click branch was removed.
   - v1271 `prepared` TDZ fix and v1269 small-selection fast path remain intact.

5. **Production deployment cleanup**
   - Firebase Hosting now ignores backend/server source, tests, developer files, patch history, audit JSON files, preview/test HTML and Firebase rules text.
   - This keeps development history in the full package but stops it being published as production static content.

6. **Regression testing made mandatory**
   - Added `npm test`, `npm run test:pabm`, and `npm run verify`.
   - PA/BM tests are now part of the default suite instead of being skipped.
   - Added runtime ownership, legacy-script, deployment, and duplicate-ID guards.

7. **HTML ambiguity cleanup**
   - Production duplicate static IDs removed/renamed.
   - Duplicate Shop dropdown IDs on Home and PA/BM now have unique IDs and matching `aria-controls`.

## Verification results

- Package version: **1.0.1272**
- Legacy combined auth+likes references in production HTML: **0**
- Likes-only runtime references: **24 pages**
- Canonical global-auth v1272 references: **37 pages**
- External JS syntax checks: **64 / 64 passed**
- Inline HTML JavaScript syntax checks: **547 / 547 passed**
- Full automated Node tests: **35 / 35 passed**
- Production HTML duplicate static IDs: **0**
- Duplicate external script source per production page: **0**
- Duplicate external stylesheet source per production page: **0**

## Important design rule after v1272

Do not reintroduce a second full auth module. Future features should attach to canonical APIs/events instead of copying `azobss-global-auth.js`. PA/BM cart additions should use `window.azobssAddToPaBmCart`; checkout should remain storefront-owned with the secure global fallback only as a readiness fallback; Lot Kadaster map open should remain early-bridge-owned.
