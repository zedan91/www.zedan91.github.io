# AZOBSS Patch 1040 — Smart Global Render Pre-Warm

Baseline: v1039.

## Changes
- Adds `/scripts/azobss-render-smart-prewarm-v1040.js` to customer-facing AZOBSS HTML pages.
- Home page does **not** immediately hit Render on every load.
- Backend-heavy navigation intent wakes Render on hover, keyboard focus, touch, or pointer-down for:
  - Software Tools
  - CAD Tools & Resources
  - PA/BM
  - Tempah Servis IT
  - Troubleshoot PC Online
  - Perkhidmatan Ukur Tanah / Beli Pelan Akui
- Homepage performs one passive wake after ~8 seconds only while the tab is visible.
- Cross-page `localStorage` throttling:
  - successful wake cooldown: 15 minutes
  - failed/in-flight attempt cooldown: 45 seconds
- Existing v1039 Software Tools wake now respects the same cross-page cooldown so Home -> Software does not immediately duplicate the health request.
- v1038 secure download timeout/retry/quota rollback remains unchanged.
- No Billplz activation. ToyyibPay/payment behavior is unchanged.
- No Render redeploy required.

Package version: `1.0.1040`.
