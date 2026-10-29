# AZOBSS v1461 — Business Documents & Mini Accounting

Date: 2026-10-29

## Goal
Upgrade the existing **Admin > Sales & Receipts** workspace into a practical AZOBSS mini accounting / business-document system without replacing the existing Quotation → Invoice → Receipt flow.

## Added business documents
New document types are managed inside the same Sales & Receipts admin workspace:

- Credit Note — `AZCN-YYYY-000001`
- Debit Note — `AZDN-YYYY-000001`
- Delivery Order — `AZDO-YYYY-000001`
- Purchase Order — `AZPO-YYYY-000001`
- Supplier Purchase — `AZSP-YYYY-000001`
- Expense — `AZEX-YYYY-000001`
- Payment Record — `AZPAY-YYYY-000001`

The existing Quotation / Invoice / Receipt numbering is preserved.

## Business Documents & Accounting workspace
Added a new integrated panel inside Admin > Sales & Receipts with:

- document creation and editing
- PDF download for every new document type
- search, document-type filter and month filter
- Customer Outstanding view
- Record Payment action
- Warranty / Serial tracking view
- KPI cards for:
  - Customer Outstanding
  - Supplier Purchases
  - Business Expenses
  - Sales Net Profit
  - Net After Expenses
- Accountant CSV export
- Excel-compatible `.xls` export
- printable / Save-as-PDF accounting report
- downloadable JSON backup
- local daily safety snapshots

## Partial payment / outstanding
Manual invoices now support an arbitrary `Amount Received (RM)` while still remaining an Invoice.

- stored `paidGross`
- stored `amountDue`
- visual status shows **PARTIALLY PAID** when appropriate
- full payment through Payment Record converts the linked manual Invoice to Paid and derives the matching AZR receipt number from its AZI number
- deleting/editing a Payment Record reverses/applies the payment delta to avoid double-counting

The existing `Deposit 50% Paid` flow remains supported.

## Credit Note / Debit Note
Credit and Debit Notes link to an Invoice.

- Credit Note reduces the adjusted invoice value / outstanding balance.
- Debit Note increases the adjusted invoice value / outstanding balance.
- Original Invoice gross value is not destructively rewritten.

## Delivery Order / Warranty
Invoice item rows now include:

- Serial No.
- Warranty Until

These fields persist in manual Sales & Receipts records and appear in the Warranty / Serial panel.

Delivery Orders can load customer and item details from a linked Invoice and can carry serial / warranty information.

## Purchase / supplier / expense records
Added:

- Purchase Order for orders to dealers / suppliers
- Supplier Purchase for actual supplier invoice / stock purchase records
- Expense with structured expense category

Supplier Purchase is tracked separately from Sales Net Profit and is **not automatically deducted a second time**, preventing double-counting where item cost is already recorded inside a sale.

## MyInvois-ready customer fields
The existing manual Quotation / Invoice / Receipt form now has optional fields:

- Customer Type — Individual / Business
- TIN
- ID Type — BRN / NRIC / Passport
- BRN / NRIC / ID
- Address
- Email / Phone (existing)
- Due Date
- Payment Terms
- Amount Received
- Payment Reference

These are stored for future e-Invoice readiness.

**AZOBSS's own TIN is not hard-coded in v1461** because no verified supplier TIN was supplied for this patch. The existing business identity remains:

`AZOBSS ENTERPRISE | SSM: 202603287983 (CT0171167-W)`

## PDF engine
`assets/js/azobss-admin-sales-receipt-pdf.js` now supports these actual document titles instead of treating unknown documents as a Receipt:

- Credit Note
- Debit Note
- Delivery Order
- Purchase Order
- Supplier Purchase
- Expense Record
- Payment Record

Business PDFs retain the AZOBSS ENTERPRISE + SSM header/footer added previously.
Serial number and warranty details are included with item descriptions where available.

## Storage / compatibility
Business-document records reuse the existing Firestore `receipts` collection with:

`source: admin-business-document-v1461`

This avoids requiring a new Firestore collection rule.
The business workspace queries only that source.

Edit/delete history snapshots are kept locally in browser storage to avoid unnecessarily filling the production `receipts` collection.

Existing customer-facing checkout, PA/BM, Liyabudun, Software Tools Pin Order, pricing, commission and payment gateway behavior are not intentionally changed by this patch.

## Main changed / added files

- `admin/index.html`
- `assets/js/azobss-admin-sales-receipts.js`
- `assets/js/azobss-admin-sales-receipt-pdf.js`
- `assets/js/azobss-admin-business-ops-v1461.js` — new
- `assets/css/azobss-admin-business-ops-v1461.css` — new
- `assets/js/azobss-global-auth.js` — version badge only
- HTML global-auth cache-bust references → `v=1461`

## Validation

- `node --check` passed:
  - `azobss-admin-sales-receipts.js`
  - `azobss-admin-sales-receipt-pdf.js`
  - `azobss-admin-business-ops-v1461.js`
  - `azobss-global-auth.js`
- 19 inline JavaScript blocks in `admin/index.html` passed syntax check.
- PDF byte generation tested for Quotation, Invoice, Receipt, Credit Note, Debit Note, Delivery Order, Purchase Order, Supplier Purchase, Expense and Payment Record.
- Global auth cache-bust references updated to v1461 on 39 HTML pages.
- Package remains flat/root-ready so Render can continue using `Root Directory: backend`.
