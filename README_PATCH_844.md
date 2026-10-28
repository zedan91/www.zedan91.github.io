# AZOBSS Patch 844 — ToyyibPay QR Payment URL

- Replaces the `Bill Code: xxxxx` line in the ToyyibPay QR panel on Admin Sales Invoice/Receipt PDF with the full ToyyibPay payment URL.
- Example display: `https://toyyibpay.com/wmcv9oh0`.
- The URL is taken from the invoice/receipt payment URL; if it is unavailable, it falls back to `https://toyyibpay.com/<BillCode>`.
- Keeps the QR scan instructions from patch 843.
- Updates the PDF script cache-buster to `v=844`.
