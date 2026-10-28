# AZOBSS v1340 — Affiliate pagination first-product smooth scroll

Baseline: v1338 source package, carrying forward the v1339 Affiliate Shop behavior (maximum 10 product rows per page, top and bottom pagination, page reset on search/category/bookmark filter changes, and compact product cards).

## v1340 change
- Clicking any Affiliate Shop pagination control (`<<`, `Previous`, page number, `Next`, `>>`) re-renders the requested page and then smooth-scrolls to the first product card of that page.
- Scroll offset accounts for the main sticky navbar and the fixed Affiliate Shop search/filter toolbar, so the first product card remains visible instead of being hidden underneath floating bars.
- Both the top and bottom pagers use the same behavior.
- The page does not scroll to the document top; it scrolls only to the first product card.
