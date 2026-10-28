# AZOBSS Patch 930 — Page-specific Social Link Preview Images

Baseline: `(929)-AZOBSS-TEMPAH-SERVIS-IT-SOCIAL-PREVIEW-FIX_20260815.zip`

Added dedicated 1200×630 social preview images and Open Graph/Twitter Card metadata for:

- `/Troubleshoot-PC-Online/`
- `/lucky-draw/`
- `/Sound-Effects/`
- `/Tempahan-Makanan/`
- `/Software-Tools/`
- `/affiliate-shop/`
- `/Perkhidmatan-Ukur-Tanah/`

Each page uses its own generated visual stored under `/assets/img/social-preview/`.
Canonical URL, `og:title`, `og:description`, `og:url`, `og:image`, image dimensions/alt text and Twitter `summary_large_image` metadata are included.

No backend or page-function changes are required. Social networks may continue to show an older preview temporarily due to their own cache.
