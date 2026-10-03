# AZOBSS v1194 — Smart Manual Payout QR + Invoice Commission Link

## Payout
- Smart Manual Payout is now the primary Admin flow: Staff Request → Review → Approve → bank/DuitNow/QR transfer → Record Payment.
- Staff/Manager Payout Profile can upload a QR image (PNG/JPG/WebP). It is resized/compressed in the browser before storing.
- Admin Payout Requests shows the QR inline so it can be scanned directly from a phone.
- Admin can copy payout details; payment reference remains required before marking Paid.
- Billplz backend compatibility remains for old/legacy records, but the Admin UI no longer depends on it.

## Create Invoice / Receipt Commission
- Search Staff/Manager by name, username, phone or email from registered users.
- Selected Staff/Manager identity is saved with the manual invoice.
- `Commission % of Gross` automatically calculates Commission RM. Manual RM edits also recalculate the percentage.
- Saving/editing a manual invoice syncs an idempotent `manual_invoice_commission` record into Admin Commission Manager and the selected Staff/Manager dashboard.
- Cancelled/refunded invoices void unpaid linked commission records; paid commission records are never silently downgraded.

## Commission Manager Manual Adjustment
- Added `% of Gross Sale` input. Example: Gross Sale RM1000 + 20% → Adjustment RM200 automatically.

- Paid manual invoice / receipt automatically makes its linked commission Approved (unless it was explicitly Rejected), so the Staff/Manager can use the normal payout workflow. Pending/deposit invoices stay Pending.
- Deleting a manual invoice first voids its unpaid linked commission record; already-paid commission history is never downgraded.
- Active payout requests read the latest QR from the Staff/Manager payout profile, so QR can be added after the request was created without duplicating the image into every request document.
