# AZOBSS v1354 — Ebook RM19 Checkout Dedup + Sales Cleanup

- Serializes Ebook Generator RM19 checkout per logged-in account to prevent two overlapping ToyyibPay bills from multiple tabs/retries.
- Re-checks lifetime ownership and existing pending bill inside the lock; an active pending bill is reused.
- Adds a stable checkout fingerprint for Ebook lifetime purchases.
- Failed bill creation is marked as an internal failed attempt and hidden from normal Sales & Receipts.
- Admin Sales & Receipts now hides only internal auto-duplicate/superseded checkout rows (`autoDuplicateSuperseded`, `duplicate-auto-checkout-paid`, or checkout-create failure). Genuine customer cancellations remain visible.
- Existing valid PAID receipt/email behavior is unchanged.
