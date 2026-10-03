# AZOBSS Patch 1043 — Software Tools Instant First Paint + Staged Catalogue Hydration

Baseline: v1042. Package version: 1.0.1043.

## Problem
`/Software-Tools/` showed the static page shell immediately but categories/cards could remain empty for about 3 seconds on desktop and close to 5 seconds on mobile. The first useful render waited for both the full Firestore query and the ~900 KB bundled `software-directory.json`. The existing fast-card cache also used different read/write keys, so it could not reliably accelerate repeat visits.

## Fix
- Unified the fast first-paint cache key as `azobss_software_fast_card_html_v1043`.
- The first 8 visible default-browse cards are now actually saved after a successful render and reused for up to 48 hours.
- Shared-product links never use cached unrelated cards.
- First-time visitors see four lightweight skeleton cards immediately instead of an empty grid.
- Category group shell is visible immediately; live category data replaces it after JavaScript initializes.
- First real data request uses only the 12 newest Firestore software records.
- The full Firestore catalogue and bundled directory hydrate after first paint using `requestIdleCallback` (650 ms timeout) or `setTimeout` fallback.
- `software-directory.json` is removed from the critical path and uses a versioned `force-cache` request (`?v=1043`) instead of `no-store`.
- Added early preconnect/DNS hints for Firebase/Firestore/Cloudinary and modulepreload for Firebase App/Firestore/Auth modules.
- Stats/promo counters continue to refresh in the background and do not block first cards.

## Scope
Frontend-only `/Software-Tools/` performance patch. No Render/backend redeploy is required specifically for v1043. Existing v1042 backend changes still require deployment if they have not already been deployed.
