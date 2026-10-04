# PATCH 843 — Invoice/Receipt ToyyibPay QR Heading

- Baseline: `(842)-AZOBSS-INVOICE-RECEIPT-TOYYIBPAY-QR-SCAN-INSTRUCTION-FIX_20260809.zip`.
- Pada panel QR ToyyibPay PDF Invoice/Receipt, tajuk `PAY WITH TOYYIBPAY` dibuang.
- Tajuk tersebut diganti dengan `Scan using your phone camera / QR scanner.`
- Ayat scan yang sama di bahagian bawah dibuang supaya tidak berulang.
- `Do not use a banking app.` dan `This QR opens the ToyyibPay payment page.` dikekalkan.
- Susun atur teks dilaras supaya panel kekal kemas dan tidak bertindih.
- Cache-buster `azobss-admin-sales-receipt-pdf.js` dinaikkan kepada `v=843`.
