# AZOBSS 1048 — Automatic Invoice / Receipt 6-Digit Global Sequence

## Scope
Extends patch 1047 from **Manual Invoice / Receipt only** to **automatic website sales** too.

## Final format
- Invoice: `AZI-YYYYMMDD-000001`
- Receipt: `AZR-YYYYMMDD-000001`
- The 6-digit sequence is global and does **not** reset every day.
- Invoice and Receipt for the same transaction share the same 6-digit sequence.

Examples:
- `AZI-20260828-000047`
- paid later -> `AZR-20260829-000047`
- next transaction -> `AZI-20260829-000048`

## Automatic sources covered
- PA/BM / JUPEM automatic checkout
- Software / CAD ToyyibPay automatic checkout
- Stripe automatic checkout
- `premiumOrders`
- `purchaseLogs`

## Important implementation
- Backend owns a Firestore transaction counter: `systemCounters/salesDocuments`.
- Counter is seeded from existing AZI/AZR values in `receipts`, `premiumOrders`, and `purchaseLogs`.
- New automatic orders receive `invoiceNo` automatically.
- When payment becomes Paid, the same transaction receives the paired `receiptNo`.
- Admin > Sales & Receipts automatically backfills legacy automatic records such as `INV-pabm-...` and `INV-stripe-...`.
- Internal `orderId`, `billCode`, Stripe IDs, and ToyyibPay references remain unchanged for payment verification.

## Manual invoices
Manual documents now reserve from the same backend counter when available, so Manual + Automatic documents share one global running sequence. If the backend is temporarily unavailable, the previous local compatibility allocation remains as fallback.

## Deploy
Because `deploy-server.js` changed, redeploy the Render backend together with the website package.
