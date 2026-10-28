# PATCH 842 — Invoice / Receipt ToyyibPay QR Scan Instruction

- Baseline: (841)-AZOBSS-TECH-VAULT-SHARE-COMPACT-HERO-REMOVE-FIX_20260808.zip
- Updated the ToyyibPay QR payment panel used by Admin Sales PDF documents.
- Replaces the ambiguous "Scan QR to open the secure payment page" wording with:
  - `Scan using your phone camera / QR scanner.`
  - `Do not use a banking app.`
  - `This QR opens the ToyyibPay payment page.`
- Enlarges the QR payment panel slightly so all three instructions remain readable without overlap.
- Paid receipts remain clean and do not display a payment QR; an unpaid/pending document that still has an active ToyyibPay payment URL can display the instruction.
- Bumped the PDF renderer cache-buster to `v=842`.
