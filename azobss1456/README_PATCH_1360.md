# AZOBSS v1360 — AZDM Purchase Audit + Ebook Fast Access

## Ebook Generator
- Short-lived (5 min) entitlement cache is keyed to the current Firebase UID.
- Previously verified lifetime access opens immediately while backend revalidation runs in background.
- Admin revocation still wins on the next background verification.
- Auth wait and access fetch are bounded; Last Used remains a fire-and-forget audit update and does not block generator rendering.
- Cache is cleared on logout or negative/revoked access response.

## AZDM Admin
- `Pesanan & email serial` upgraded to `Pesanan, Pembayaran & Audit`.
- Added search across customer, email, Firebase UID, Order ID, BillCode, transaction/payment references and Stripe IDs.
- Added `View` drawer with Firebase UID, order/payment proof, verification timestamps, invoice/receipt refs, fulfilment state and issued license IDs when available.
- Copy buttons are provided for audit IDs.
- Background page scrolling is locked while the drawer is open.

## Notes
- Purchase/payment audit uses only fields that exist in the stored AZDM order; it does not invent device/reset history that is not recorded by the current license service.
