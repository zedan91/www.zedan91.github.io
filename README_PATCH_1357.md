# AZOBSS v1357 — Stripe Actual Fee Sync

- Paid Stripe orders now read the real processing fee from Stripe `PaymentIntent -> Charge -> Balance Transaction`.
- `paymentFee`, `gatewayFee`, `stripeFee`, `stripeNet`, Charge ID and Balance Transaction ID are stored with the premium order.
- Admin > Sales & Receipts exports those fee fields, so Costs / Profit use the actual Stripe fee instead of RM0.
- A limited automatic backfill runs for legacy paid Stripe rows when Admin Sales & Receipts loads.
- No hard-coded Stripe percentage is used; international-card / FX fees therefore remain accurate.
- Existing ToyyibPay RM1 handling is unchanged.
