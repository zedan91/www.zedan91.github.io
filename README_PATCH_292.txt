(292)-AZOBSS-SHOP-CARD-DESC-SHARE-GIF-NO-REFLOW-FIX_20260622

Baseline: (291)-AZOBSS-SHOP-CARD-MOBILE-FOOTER-VISIBLE-FIX_20260622

Scope:
- Software Tools
- CAD Tools & Resources

Fix:
- Desc More button no longer runs repeated scan/restyle loops.
- Share button is not removed/recreated and no longer gets inline top/right reflow on repeated auth/stat refresh.
- Preview GIF floating button no longer gets inline top/right reflow after first paint.
- Removed repeated timer reflows for share/preview controls.
- Added final stable control positioning CSS for mobile/desktop.

Not touched:
- PA/BM paid/verified download flow
- My Purchases
- Cart storage/payment logic
- Bell/message badge logic
- Firebase Rules
- Render ENV
