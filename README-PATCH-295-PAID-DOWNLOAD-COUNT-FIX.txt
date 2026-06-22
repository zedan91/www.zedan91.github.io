(295)-AZOBSS-PAID-PRODUCT-DOWNLOAD-COUNT-AFTER-PAID-FIX

Scope:
- Software Tools product download counter.

Fix:
- Premium/paid product Buy Now click no longer increments download count.
- Free product Download Now still increments immediately on click.
- Paid product download count increments only after ToyyibPay/FPX verification returns paid/success to the Software Tools page.
- Uses order/bill id guard to avoid duplicate increment for the same paid order.

Not touched:
- PA/BM paid/verified download flow.
- My Purchases.
- Cart storage/payment logic.
- Bell/message badge logic.
- Firebase Rules.
- Render ENV.
