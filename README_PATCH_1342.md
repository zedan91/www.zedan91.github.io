# AZOBSS Website v1342 — Affiliate Price Sort

Baseline: v1341.

Changes:
- Added a dedicated **Price** sort control beside the existing category filter in Affiliate Shop.
- Options: **Default**, **Low → High**, **High → Low**.
- Price sorting uses `priceMyr` when available, otherwise the first MYR value shown on the product card (including the minimum value of a displayed price range).
- Products without a usable numeric price stay at the end for both directions.
- Changing price sort resets product pagination to page 1.
- Existing search, category, bookmarks, 10-row pagination, smooth-scroll pagination, and compact auto-height cards remain unchanged.
