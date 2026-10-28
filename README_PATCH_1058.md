# AZOBSS 1058 — Website Auto Invoice / Receipt Status + Payment Method Admin Override

## Baseline
- Built from v1057.
- Keeps v1056 Render smart wake and v1055 PA/BM ToyyibPay recovery.
- v1051 and v1052 remain cancelled.

## Scope
- Admin → Sales & Receipts only.
- Automatic website Invoice / Receipt rows from `purchaseLogs` / `premiumOrders`.
- Manual Invoice / Receipt flow is unchanged.

## New editable fields for Website Auto records
Admin can now edit:
- Status: `Pending`, `Paid`, `Refunded`, `Cancelled`
- Payment Method: `Bank Transfer`, `Cash`, `ToyyibPay`, `Stripe`, `Card`, `QR Payment`, `Other`, `Manual / Other`
- Customer Name / Phone / Email / Address
- Product / Service description
- Notes

## Safety model
Status and Payment Method edits are **Admin Overrides**, not mutations of the real gateway transaction.

The original website payment record remains unchanged, including:
- ToyyibPay / Stripe status
- ToyyibPay Bill Code / Stripe IDs
- Order ID / payment reference
- Verified amount
- Download entitlement / token flow
- Automatic payment verification

The override document stores snapshots of the original verified status/payment method plus the admin-selected display override.

Example:
```text
Verified Status        : Pending
Admin Status Override  : Paid
Verified Method        : ToyyibPay
Admin Method Override  : Bank Transfer
```

Admin → Sales & Receipts and generated PDF/Print/Share use the overridden values and visibly mark manual overrides. A manually overridden `Paid` status is shown as `PAID - MANUAL OVERRIDE` in the PDF and does **not** unlock customer downloads or become a ToyyibPay-verified payment.

If the real gateway status later becomes the same as the override (for example ToyyibPay eventually verifies `Paid`), the row is no longer labelled as a conflicting manual status override.

## Still locked for Website Auto records
- Invoice / Receipt number
- Transaction date/time
- Quantity
- Unit price / total amount
- Discount / shipping values
- Payment fee / commission / other accounting values
- Gateway/internal IDs and payment references

## Receipt delivery safety
A manual `Pending → Paid` override no longer causes the system to assume the website automatically sent a verified receipt. Automatic receipt-sent state is based on the **real verified gateway status**, not the admin display override.

## Deployment
Website deploy only.
`deploy-server.js` is unchanged, so Render backend redeploy is not required.

## Version
`1.0.1058`
