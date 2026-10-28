# AZOBSS v1329 — Affiliate Card Compact Description / Show More

Baseline: v1328 full website.

Changes on `/affiliate-shop/` only:

- Product cards no longer grow to match an unusually long description.
- Desktop cards use a consistent 405px height; mobile uses 390px.
- Product title is clamped to keep rows tidy.
- Description preview is clamped to 5 lines.
- Long descriptions get a `Show More` button.
- `Show More` opens a modal instead of expanding the card, so the grid stays aligned.
- Full description is reformatted into readable paragraphs, including common BM/ENG/DESCRIPTION section markers and bullet separators.
- Existing Buy Now, Shopee import, Firestore strict-save/retry, Tick/Untick, Delete and Pin behaviour is preserved.

Package version: `1.0.1329`.
