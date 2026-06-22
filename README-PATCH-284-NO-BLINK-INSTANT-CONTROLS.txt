(284)-AZOBSS-SHOP-CARD-INSTANT-CONTROLS-NO-BLINK-FIX

Baseline used:
(277)-AZOBSS-SOFTWARE-CAD-MOBILE-GIF-PREVIEW-PERSISTENT-MODAL-FIX_20260622_20260622_145855.zip

Purpose:
- Keep product cards looking complete immediately for customers.
- Like / Share / Preview GIF / rating / downloads appear directly from initial render.
- Async Firebase updates happen silently in the same existing elements, not by removing/recreating UI.

Changes:
1. Software Tools:
   - Premium cards render share button immediately.
   - Cards render like button immediately.
   - Cards render rating/download footer immediately from current local/item values.
   - Stats sync updates only text/classes in place, avoiding innerHTML replacement blink.
   - Share button updater no longer removes/recreates buttons on repeated timers/mutations.

2. CAD Tools:
   - Premium cards render share button immediately.
   - Cards render like button immediately.
   - Share button updater no longer removes/recreates buttons on repeated timers/mutations.

3. Global likes script:
   - Like buttons are injected/bound instantly without waiting for Firestore likes query.
   - Cached like status is used first, then Firestore status updates silently.
   - Existing placeholder like buttons are bound instead of duplicated or skipped.

Not touched:
- PA/BM paid/verified download flow.
- My Purchases.
- Cart logic.
- Bell/message badge logic.
- Firebase Rules.
- Render ENV.
