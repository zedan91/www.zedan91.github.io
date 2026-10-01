# AZOBSS v1189 — Commission Manager Pro Audit-Safe Workflow

## Main fixes
- Commission Manager now loads commission records from the protected backend API first. It no longer queries `commissionRecords` directly from the browser during normal use, removing the misleading Firestore permission warning when backend data is actually available.
- Backend commission listing now supports cursor pagination and the Admin UI can load up to 2,000 records in pages.
- Unique sales are deduplicated by Order ID / Bill Code so owner + sharer commission lines do not double-count sales.
- Average commission rate uses active auto-generated commission lines against unique sales value; manual adjustments and void records do not distort the rate.
- New KPI layout: total active commission, pending, ready-to-pay, paid, unique sales, unique sales RM, average commission %, active/void record count.
- New Staff / Manager payout summary with Pending / Ready / Paid and last paid date; click a staff card to filter.
- Filters expanded with Software/CAD source, amount range and Void status.

## Payout workflow hardening
- Commission payout flow is now `Pending -> Approved -> Paid`.
- Pending cannot jump directly to Paid.
- Paid records are final in the normal status workflow; corrections use Void/Reverse.
- Mark Paid requires both payment/transfer reference and payout method.
- Bulk Paid requires all selected records to be Approved and to belong to one Staff/Manager only.
- Selected summary now shows record count, selected RM and number of staff.
- Payout Requests also require Approved before Paid and require payout reference/method.
- Approving a payout request synchronizes linked commission records to Approved; Paid synchronizes them to Paid without downgrading already-paid records.

## Audit-safe corrections
- Physical Delete was removed from Commission Manager.
- Added `Void` / reverse flow with a mandatory reason; record remains stored for audit.
- Auto-generated commission records cannot be edited directly.
- Added `Adjustment` action to create a separate positive/negative manual correction linked to the original commission record.
- Manual adjustments use protected backend endpoints instead of direct Firestore browser writes.
- New basic audit panel checks possible duplicate lines, rate mismatch, Paid without reference, manual adjustments and void records.

## UI cleanup
- Commission Manager labels are more consistently Malay while keeping familiar accounting terms such as Pending / Approved / Paid.
- Commission API status chip clearly shows backend connection state instead of a large misleading Firestore warning.
- Commission type labels now distinguish Owner Direct Sale, Owner Split Sale, AZOBSS Referral 20%, Other Staff Referral and Manual Adjustment.

## Production backend
New/updated protected endpoints in `deploy-server.js`:
- `GET /api/commission/status` — paginated protected records.
- `POST /api/commission/payout-status` — transition rules + paid reference/method validation.
- `POST /api/commission/adjustment` — create/update manual adjustments only.
- `POST /api/commission/void` — audit-safe void/reverse.

Production start remains `node deploy-server.js`.
