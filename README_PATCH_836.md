# AZOBSS Patch 836 — Compact Invoice Billing Info / One-Page Fit

Baseline: patch 835.

Changes:
- Compact the invoice/receipt customer and document information box from stacked label/value pairs into single-line rows.
- Example: `BILL TO : zedan91`, `PHONE : 011...`, `INVOICE NO. : AZI-...`, `ISSUE DATE : ...`.
- Reduce the information box height and move the item table upward to reclaim vertical A4 space.
- Long values automatically reduce font size within their column instead of overflowing.
- Existing QR/ToyyibPay, totals, Notes, footer, service-booking, WhatsApp and all patch 835 functionality are retained.
- Pagination remains available only when content is genuinely too long for one A4 page.
