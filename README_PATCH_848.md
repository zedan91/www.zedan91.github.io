# Patch 848 — Invoice/Receipt Payment Block Closer to Table

- Moves the combined ToyyibPay QR + Total Payable row upward so it sits close to the bottom of the invoice item table.
- Removes the previous automatic downward shift that could add up to 42 pt of empty space above the payment block.
- Uses a compact 8 pt gap after the item table.
- Keeps QR alignment, larger scan/warning/URL text, totals, closing line, and all payment behaviour from patch 847.
- Cache-buster updated to `azobss-admin-sales-receipt-pdf.js?v=848`.
