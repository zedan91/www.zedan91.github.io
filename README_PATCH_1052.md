# AZOBSS v1052 — Global Stickybar Stable First Paint Fix

Baseline: v1050. The cancelled old v1051 package is not used.

## Fix
- Stickybar geometry is now defined by one static CSS file loaded in `<head>`, before first paint.
- More and Repair PC keep the same width before/after JavaScript upgrades them into dropdowns.
- Admin/Staff, PA/BM/Public PA and WhatsApp role/access changes no longer collapse their layout slots.
- Removed delayed JavaScript CSS injections that previously changed stickybar height/spacing after page load.
- All pages with `.market-sticky-bar` receive the same final layout lock.

No backend/payment changes. Render redeploy is not required.
