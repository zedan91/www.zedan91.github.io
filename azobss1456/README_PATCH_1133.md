# AZOBSS Patch 1133 — Homepage Software Promo Source-of-Truth Fix

Date: 16 September 2026
Package version: `1.0.1133`
Baseline: v1132

## Fixed

- Homepage **SOFTWARE PROMO** slider now shows only software with a real discounted price (`originalPrice > price`) or a genuinely enabled limited **Free Promo**.
- Ordinary products are no longer pulled into the slider merely because an old `promoEnabled`, `featuredPromo`, badge, label or similar marketing field remains in Firestore.
- **AZOBSS SolatTime** therefore keeps its normal paid promotion (for example RM30 → RM20) and the slider displays the current paid promo price rather than incorrectly showing `FREE`.
- **AZOBSS Windows Update OneClick Fix** is excluded when it has neither a discounted price nor an active Free Promo.
- `promoFreeEnabled` is now the canonical Free Promo switch in the homepage, Software Tools page and premium-download backend. Legacy fields (`freePromoEnabled`, `promoFreeDownloadEnabled`) are used only when the canonical field is absent, so stale legacy values cannot override `promoFreeEnabled:false`.

## Deploy

- Push frontend/static files.
- Redeploy the main Render backend because the Free Promo server guard was hardened too.
- No Firebase Rules or Lucky Draw backend change is required.
