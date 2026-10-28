# Patch 846 - ToyyibPay QR Vertical Alignment

- Lowers the ToyyibPay QR image inside Admin Sales Invoice/Receipt PDF.
- The top edge of the QR now aligns with the wrapped second line `scanner.` from `Scan using your phone camera / QR scanner.` instead of the first line.
- Payment text, amount, URL, warning and all other PDF behavior remain unchanged.
- Cache-buster for `azobss-admin-sales-receipt-pdf.js` updated to `v=846`.
