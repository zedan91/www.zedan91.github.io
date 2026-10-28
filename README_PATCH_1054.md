# AZOBSS Patch 1054 — PA/BM + Software Stickybar Early CSS First-Paint Fix

Baseline: v1053.

## Scope
Only two target pages that still showed visible stickybar first-paint glitch in the supplied navigation video:
- `PA-BM/index.html`
- `Software-Tools/index.html`

## Fix
- Move the existing `azobss-global-compact-font-more-nav.css?v=910` stylesheet link to the top of `<head>` immediately after the viewport meta tag.
- The stylesheet itself is unchanged.
- Stickybar DOM, auth/role logic, PA/BM access rules, More menu, Repair PC menu, dimensions and final appearance are unchanged.
- This prevents the pre-rendered v1053 `Repair PC` / `More` DOM from briefly rendering before its CSS is available.

## Intentionally untouched
- CAD Tools
- Affiliate Shop
- Lucky Draw
- Repair PC pages
- More menu destination pages
- Backend / ToyyibPay / Firestore

Package version: `1.0.1054`.
