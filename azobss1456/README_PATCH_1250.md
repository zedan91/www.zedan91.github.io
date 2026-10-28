# AZOBSS v1250 - Failed/Cancelled Payment Stays in Cart

This patch changes PA/BM purchase-history semantics so payment attempts are not treated as purchases.

## Behaviour
- Pending, cancelled, failed, rejected or abandoned ToyyibPay attempts do **not** enter `Senarai Pembelian Terkini`.
- `purchaseLogs` is now written only after the backend has verified the payment as paid/successful.
- The cart is intentionally preserved while the customer leaves AZOBSS for ToyyibPay.
- A local checkout-cart backup is saved before redirect; if payment is cancelled/unsuccessful or never completes, the cart is restored automatically if necessary.
- Existing legacy pending rows from older builds are filtered out of `Senarai Pembelian Terkini` immediately.
- Successful verified payments still clear the cart and then appear in `Senarai Pembelian Terkini` with the normal download quota.

## Scope
No state-picker, product-search, pricing formula, PA/BM Add to Cart flow, or paid download logic is intentionally changed.
