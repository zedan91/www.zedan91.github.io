# AZOBSS v1463 — Maybank Default Payment Method

Based on full v1462.

## Change
- Admin > Sales & Receipts > Create Manual Invoice now defaults Payment Method to **Maybank**.
- Existing records preserve their saved payment method.
- Website/automatic records preserve their verified/original gateway method.
- Quotation still uses Not Applicable until converted to Invoice.
- Other payment choices remain available, including Bank Transfer, Cash, ToyyibPay, Stripe, Card, QR Payment, Other and Manual / Other.

## Release
- Sales & Receipts cache-bust updated to v1463.
- Global version badge/cache-bust updated to v1463.
- No payment gateway processing logic was changed.
