# AZOBSS Patch 1170 — Deposit Terms Opt-In + AZOBSSTV Firefox Live TV Compatibility

Baseline: 1.0.1169
Version: 1.0.1170
Date: 28 Sep 2026

This is a cumulative full-site package based on the latest full AZOBSS 1.0.1169 package.

## Sales & Receipts / Invoice PDF
- Deposit Terms is no longer shown automatically.
- Create/Edit Invoice now includes `Show Deposit Terms on Invoice`.
- The checkbox is OFF by default.
- Legacy invoices with no saved setting are treated as OFF.
- Deposit Terms is rendered in the PDF only when `showDepositTerms === true`.
- The option is hidden/disabled when the document is a Receipt.
- Website automatic invoice edit overrides and manual invoices both persist the setting.

## AZOBSSTV Firefox Live TV
- AZOBSSTV app version is raised from 1.0.1085 to 1.0.1086.
- Firefox detects Mana-Mana official Live TV channels and first attempts native HLS/DASH playback.
- HLS uses the existing AZOBSSTV backend stream relay where applicable.
- Stream URLs supplied by the backend are preserved and preferred.
- Firefox prewarms the first Live TV channels in the background and caches resolved streams for 10 minutes.
- If native playback does not become ready within 14 seconds, AZOBSSTV falls back to the previous official iframe flow.
- Chrome/Edge official-player behaviour is preserved.

## Files directly changed in 1170
- `package.json`
- `admin/index.html`
- `assets/js/azobss-admin-sales-receipts.js`
- `assets/js/azobss-admin-sales-receipt-pdf.js`
- `AZOBSSTV/index.html`
- `AZOBSSTV/assets/azobsstv.js`
- `AZOBSSTV/sw.js`

All files and assets from the 1.0.1169 full website package are included in this ZIP.
