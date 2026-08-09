# AZOBSS Patch 849 — Invoice/Receipt larger ToyyibPay text + clickable payment URL

- Based on patch 848.
- Enlarged `Scan using your phone camera / QR scanner.` to 7.8 pt.
- Enlarged `Do not use a banking app.` to 7.5 pt.
- Enlarged the ToyyibPay URL to 7.8 pt.
- Added `Tap / click the link above to open the payment page.` directly below the URL.
- Added an actual PDF hyperlink annotation over the ToyyibPay URL, so tapping/clicking the URL in compatible PDF viewers/browsers opens the payment page.
- Moved the thank-you sentence 6 pt closer to the payment block.
- Kept the compact 8 pt item-table-to-payment-block spacing and QR alignment from patch 848.
- Cache-buster updated to `azobss-admin-sales-receipt-pdf.js?v=849`.
