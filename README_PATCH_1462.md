# AZOBSS v1462 — Quotation Title + Compact Actions Fix

Base: v1461 Business Documents & Mini Accounting.

## Changes

1. Quotation PDF title simplified from `QUOTATION / SEBUT HARGA` to `QUOTATION`.
2. Admin > Sales & Receipts help/status wording now uses `Quotation` only for this document flow.
3. Quotation row Actions no longer use full-width text buttons for `Accept` and `Convert to Invoice`.
   - Accept is now a compact circular check icon (✓ style SVG).
   - Convert to Invoice is now a compact circular right-arrow icon (→ style SVG).
   - Existing tooltips and ARIA labels preserve the action meaning.
4. Actions grid is constrained to four compact icons per row and capped to the column width to prevent overflow.
5. Cache-busts for Sales & Receipts CSS/JS/PDF JS and global auth updated to v1462.
6. Global website version badge updated to v1462.

## Preserved

- v1461 Credit Note, Debit Note, Delivery Order, Purchase Order, Supplier Purchase, Expense and Payment Record modules.
- Partial payments/outstanding, serial/warranty, MyInvois-ready fields, reports, exports and backup.
- SSM identity on business documents.
- v1457+ flat/root-ready repository layout for Render `Root Directory: backend`.
- Existing customer-facing flows not related to this patch.

## Validation

- `azobss-admin-sales-receipts.js`: Node syntax check passed.
- `azobss-admin-sales-receipt-pdf.js`: Node syntax check passed.
- `azobss-global-auth.js`: Node syntax check passed.
- 39 HTML global-auth cache-bust references updated to v1462.
- ZIP integrity verified after packaging.
