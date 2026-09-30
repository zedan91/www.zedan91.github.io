# AZOBSS Patch 845 — ToyyibPay QR Warning Directly Below Scan Instruction

- Moves `Do not use a banking app.` directly below `Scan using your phone camera / QR scanner.` in the ToyyibPay QR panel on Admin Sales Invoice/Receipt PDF.
- Moves Amount and the full ToyyibPay payment URL slightly lower so the scan warning is read first.
- Keeps `This QR opens the ToyyibPay payment page.` below the payment URL.
- Keeps the full payment URL behavior from patch 844.
- Updates the PDF script cache-buster to `v=845`.
