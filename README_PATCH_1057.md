# AZOBSS 1057 — Website Auto Invoice / Receipt Safe Edit

## Baseline
- Built from v1056.
- v1051 and v1052 remain cancelled and are not used.

## Scope
- Admin → Sales & Receipts.
- Automatic website purchases from `purchaseLogs` / `premiumOrders`.
- Manual Invoice / Receipt behavior remains unchanged.

## Fix
Automatic website Invoice / Receipt rows now have an **Edit** action.

Editable display fields:
- Customer Name
- Phone
- Email
- Address
- Product / Service description
- Notes

Locked payment-critical fields:
- Invoice / Receipt number
- Transaction date / time
- Status
- Payment method
- Quantity
- Unit price / total amount
- Discount / shipping values
- Payment fee / commission / other accounting costs
- ToyyibPay / Stripe / internal order IDs and payment references

## Storage safety
Edits are stored as a separate admin-only display override inside the existing `receipts` collection with source:

`admin-auto-invoice-edit`

The original automatic payment/order record is not rewritten. This prevents an invoice wording/customer correction from breaking ToyyibPay verification, payment reconciliation, order IDs, download access, or automatic Invoice → Receipt conversion.

The override is automatically applied when Admin → Sales & Receipts loads, so PDF download, print, share link and the table use the edited display information.

If the underlying website payment record is deleted from Sales & Receipts, its edit override is cleaned up as well.

## Deployment
Website deploy only. `deploy-server.js` is unchanged, so Render backend redeploy is not required.

## Version
`1.0.1057`
