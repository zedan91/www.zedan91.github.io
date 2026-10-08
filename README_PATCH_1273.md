# AZOBSS v1273 — Canonical Cart Button Highlight Fix

- Fixes PA/BM result-table Add to Cart buttons not remaining highlighted after an item is added.
- Root cause: v1272 made the inline classic cart core the canonical cart owner, but visual `.is-in-cart` synchronization still lived only in the optional storefront ES module. Cart data could update while the button stayed blue.
- v1273 moves visual cart-button synchronization into the canonical classic cart core too.
- Covers PA, BM/SBM, GPS and Syit Piawai result-table cart buttons.
- Active state uses `.is-in-cart`, `aria-pressed=true`, green styling and check mark.
- MutationObserver reapplies state when search/pagination renders new result rows.
- Remove/re-add and fresh page render resync from actual cart contents.
- No checkout, auth, Lot Kadaster processing or payment business logic changed.
