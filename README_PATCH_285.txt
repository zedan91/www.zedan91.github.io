(285)-AZOBSS-SHOP-CARD-REAL-STATS-FIRST-PAINT-FIX

Patch scope:
- Software Tools first-paint rating/download stats.
- Stats are prefetched from Firestore settings/softwareStats before dynamic cards render.
- Cached Firestore stats are reused immediately on later visits.
- Rating/download footer updates in-place, without replacing the whole footer.
- Firestore stats read no longer forces Firebase Anonymous Auth for guest read.

Not touched:
- PA/BM paid/verified download flow.
- My Purchases.
- Cart logic.
- Bell/message badge logic.
- Firebase Rules.
- Render ENV.
