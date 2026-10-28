# AZOBSS v1370 — PA/BM Paid Cart Clear + Same-Transaction Invoice/Receipt Guard

Date: 21 Oct 2026
Baseline: v1369

## Fixes
- A verified PA/BM ToyyibPay payment now clears the canonical browser cart, payment backup, pending-return keys, and durable server cart draft.
- Fixes the recovery branch that could clear a paid server draft but then fall through and report it as pending/cart again.
- If the exact pre-payment cart is resubmitted shortly after the same fingerprint is already Paid, backend returns the existing Paid order instead of creating another Pending invoice / consuming a new sequence.
- Recovery also detects a later stale duplicate Pending order, marks it superseded/hidden, and returns the original Paid order.
- Paid PA/BM purchaseLogs are synchronized only after enforcing the premium order document pair so Invoice `AZI-...-NNNNNN` and Receipt `AZR-...-NNNNNN` keep the same transaction sequence.
- Admin Sales & Receipts suppresses stale duplicate Pending rows when their cart snapshot clearly predates a Paid order with the same checkout fingerprint.

## Expected flow
1. Checkout creates one Pending invoice, e.g. `AZI-20261021-000164`.
2. ToyyibPay confirms the same order.
3. The same transaction becomes `AZR-20261021-000164` (same numeric suffix).
4. PA/BM cart becomes empty immediately after verification, including late server-side recovery.
5. A stale second click cannot create `...000165` for the just-paid cart.
