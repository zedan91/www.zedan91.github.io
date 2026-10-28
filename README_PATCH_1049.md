# AZOBSS 1049 — New-Transactions-Only Invoice / Receipt Numbering

## Final policy
- Manual documents continue to use `AZI-YYYYMMDD-000001` / `AZR-YYYYMMDD-000001`.
- **Only new automatic website transactions** receive the new 6-digit AZI/AZR document numbers.
- Historical automatic transactions are **not backfilled or renumbered**.
- Existing legacy IDs such as `INV-pabm-*`, `INV-stripe-*`, and their derived receipt IDs remain exactly as historical records.
- Internal `orderId`, `billCode`, Stripe IDs, ToyyibPay references, and Firestore document IDs remain unchanged.

## New automatic transaction flow
1. On the first Firestore persist of a new `premiumOrders` transaction, backend reserves one global 6-digit sequence.
2. The transaction gets `AZI-YYYYMMDD-######`.
3. When that same transaction becomes Paid, it gets `AZR-YYYYMMDD-######` using the **same sequence**.
4. PA/BM `purchaseLogs` inherit the paired numbers only from a newly-numbered parent transaction.

## Historical safety
- Admin > Sales & Receipts no longer triggers automatic backfill on load.
- `action=backfill` is retained only as a harmless compatibility no-op for cached v1048 pages.
- Opening/downloading an old receipt does not allocate a new number.
- Updating an existing old automatic order does not allocate a new number.

## Counter
`systemCounters/salesDocuments` remains the shared global sequence for Manual + new Automatic documents and does not reset daily.

## Deploy
Website + Render backend must both be redeployed because `deploy-server.js` and Admin JS changed.
