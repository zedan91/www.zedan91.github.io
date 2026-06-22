(290)-AZOBSS-SHOP-CARD-SINGLE-CLEAN-MERGED-STATS-SCRIPT-FIX

Baseline used: (287)-AZOBSS-SHOP-CARD-FIRST-PAINT-CONTROLS-NO-BLINK-FIX_20260622.zip

Fix summary:
- Cleaned Software Tools rating/download stats overlap.
- Removed old AZOBSS SOFTWARE STATS FIRESTORE FINAL CLEAN block that replaced .software-stats innerHTML repeatedly.
- Added one merged stats script only: AZOBSS SOFTWARE STATS SINGLE CLEAN MERGED.
- Stats now update existing .azb-dl-number, .azb-rate-value, .azb-rate-votes and stars in place.
- Added Firestore softwareStats prefetch before dynamic card render, so first paint can use the real stats cache.
- normalizeStats now preserves ratingVotes / votes / ratingCount / ratingAverage.
- If Firestore has downloads but no rating, product rating is not overwritten to 0.
- Download/rating writes use the same single stats script.

Not touched:
- PA/BM paid/verified download flow.
- My Purchases.
- Cart storage/payment logic.
- Bell/message badge logic.
- Firebase Rules.
- Render ENV.

Deploy notes:
- Firebase Rules update: not required.
- Render ENV update: not required.
