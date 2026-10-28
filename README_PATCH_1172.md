# AZOBSS Patch 1172 — PC Build Malaysia Low-to-High

Baseline: 1.0.1171
Version: 1.0.1172
Date: 1 Oct 2026

This is a cumulative full-site package. All changes from 1171 are preserved.

## New: `/PC-Build/`
- Adds a dedicated PC Build page from Low / Office to Very High / RTX 5080.
- Six build tiers with Malaysia-market price guidance, CPU, GPU, motherboard, RAM, storage, PSU, cooling and casing.
- Default sorting is Low → High.
- Search, use-case filter, maximum-budget filter and price sort.
- Each build has Copy Spec and Tanya / Tempah actions.
- Price data is separated into `/PC-Build/pc-build-data.json` so future price/spec updates do not require rewriting the page HTML.
- Shows explicit market, price-check date and a notice that prices vary with stock, brand and promotions.
- Market references used for this revision: Ideal Tech and ALL IT Hypermarket Malaysia.

## Home / SEO integration
- Adds `PC Build` to the common AZOBSS top navigation across the main public/admin/staff pages.
- Adds a visible `PC Build — Low → High` card to Home hero actions.
- Adds PC Build to Home structured page list and services subtitle.
- Adds `/PC-Build/` to sitemap.xml.

## Preserved from 1171
- All AZOBSSTV A/V recovery changes.
- Invoice deposit terms, Admin, PA/BM, Software Tools, CAD Tools and existing website functionality remain unchanged.

## Files changed / added
- `package.json`
- `index.html`
- `sitemap.xml`
- `PC-Build/index.html`
- `PC-Build/pc-build-data.json`
- `README_PATCH_1172.md`
- `AZOBSS-PC-BUILD-MALAYSIA-AUDIT-1172.json`
