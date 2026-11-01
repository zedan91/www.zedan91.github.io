# AZOBSS v1479 — PC Shop Deferred Invoice + Courier Address + Duplicate Guard

Baseline required: **v1478** (Render runtime uses `deploy-server.js` + `lib/azobss-pc-shop-runtime.js`).

This ZIP is a **merge patch**. Extract/copy it over the current v1478 repository root. Do not delete files that are not inside this patch.

## What v1479 changes

### 1. Correct order lifecycle
For PC Build / Hardware checkout that still needs price confirmation:

1. Customer presses **Place Order**.
2. Backend creates only `AZO-YYYY-XXXXXX`.
3. `invoiceNo` remains blank.
4. `paymentStatus` stays `not-ready`.
5. No `purchaseLogs` / Sales & Receipts row is created yet.
6. Admin confirms the final selling price.
7. If Courier is selected, the order stays at `shipping-confirmation` until a shipping charge is entered.
8. Only when price + required shipping are ready does the backend issue `AZI-YYYY-XXXXXX` and sync the row to Sales & Receipts as pending.
9. Receipt `AZR-...` is only issued after payment is marked paid.

### 2. Courier address is mandatory
- Selecting **Courier** makes `Delivery Address *` required in the checkout UI.
- Frontend blocks Place Order if it is empty.
- Backend independently blocks the request with `courier_address_required` if an empty Courier address bypasses the UI.
- Pickup AZOBSS: address not required.
- Arrange with AZOBSS: address not required at order stage.

### 3. Duplicate Place Order protection
A deterministic order fingerprint is stored and checked for a 15-minute window.
If the same logged-in customer submits the same item/qty/shipping/customer details again, the existing AZO order is returned instead of creating another order/invoice.

### 4. Admin Confirm Price flow
Admin > Sales & Receipts > **PC Shop Orders** now shows:
- `Confirm Price` for normal checkout awaiting price confirmation.
- `Confirm Price & Convert to Order` for quote requests.
- `Order only • invoice not issued` until the invoice is genuinely ready.
- Invoice number once it has been issued.

Courier flow:
- Confirm Price + Shipping Charge RM0 -> `shipping-confirmation`, no invoice.
- Enter Shipping Charge and Save -> invoice issued automatically, payment becomes `pending`.

Pickup / Arrange flow:
- Confirm Price -> invoice can be issued immediately because courier charge is not required.

### 5. Repair old premature v1478 invoices
Admin PC Shop Orders now has **Repair Premature Invoices**.
It scans PC Shop orders and, for unpaid orders that are not invoice-ready:
- clears premature `AZI-...`,
- restores `documentNo` to the AZO/quote order,
- keeps the customer AZO order,
- resets payment to `not-ready`, and
- removes the stale deterministic `purchaseLogs/pcshop-AZO-...` row so it disappears from Sales & Receipts after refresh.

Paid orders are not modified by this repair.

## Files in this patch
- `lib/azobss-pc-shop-runtime.js` — primary Render runtime v1479.
- `assets/js/azobss-pc-shop-v1479.js` — customer checkout/My Orders UI.
- `assets/js/azobss-admin-pc-shop-orders-v1479.js` — admin confirmation + repair UI.
- `PC-Build/index.html` — loads v1479 customer script while retaining v1478 auth/session assets.
- `admin/index.html` — loads v1479 admin PC Shop script while retaining v1478 auth/session assets.
- `backend/server.js` — compatibility implementation updated to the same v1479 rules.

## deploy-server.js
No edit is required. v1478 already imports:

`./lib/azobss-pc-shop-runtime`

The patch replaces that module at the same path, so Render automatically uses v1479 after redeploy.

## Validation performed
- Node syntax check: runtime, customer JS, admin JS, compatibility backend.
- Simulated Firestore flow:
  - blank Courier address blocked,
  - Price Confirmation creates AZO only,
  - duplicate submission reuses existing AZO,
  - Confirm Price with Courier RM0 does not issue invoice,
  - adding shipping charge issues AZI and sets payment pending,
  - purchase log appears only after invoice readiness,
  - repair removes a seeded premature v1478 AZI/purchase log.

