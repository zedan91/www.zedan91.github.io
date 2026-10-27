# AZOBSS v1445 — Software Affiliate Card Layout Fix

- Baseline: v1444.
- Removed the customer-facing affiliate disclosure text `Pautan affiliate • pembelian dibuat di laman rakan niaga`.
- Affiliate CTA remains `Lihat Tawaran`; affiliate links remain marked `rel="noopener sponsored"`.
- Affiliate clicks still do not increment the software download counter.
- Added an explicit affiliate-card marker and a post-render layout normalizer so the software logo is kept before the title in the DOM.
- Added final logo-first order rules for affiliate cards: logo → title → meta → description → CTA.
- Liyabudun account label fix and all v1444 changes are preserved.
- Global version badge/cache-bust raised to v1445.
