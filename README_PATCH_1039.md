# AZOBSS Patch 1039 — Software Tools Render Pre-Warm

Baseline: v1038.

Changes:
- `/Software-Tools/` sends a non-blocking request to the configured AZOBSS backend `/health` shortly after page load.
- Adds DNS-prefetch and preconnect for the default Render backend.
- Hover, keyboard focus, touch intent, and returning to the tab refresh the warm state with a 45-second cooldown.
- Free Promo click keeps a forced wake request as a final safety net.
- Existing v1038 timeout/retry and promo quota rollback remain unchanged.
- No payment gateway changes. Billplz remains on hold; ToyyibPay is unchanged.
- No Render redeploy is required.

Package version: 1.0.1039.
