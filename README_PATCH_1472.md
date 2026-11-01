# AZOBSS v1472 — PC Build & Hardware Shopping Place

Date: 2026-11-01
Baseline: v1471 full website

## Goal
Turn the existing PC Build section into a simple AZOBSS-owned shopping place inspired by useful retail/custom-PC flows, without creating a multi-vendor marketplace and without exposing competitor/store identities to customers.

## Research references used internally
- EMARQUE gaming PC / custom builder flows: product customization, Add to Cart, Get Quote, component-by-component builder.
- NB Plaza hardware/desktop catalogue flows: category browsing, filters/sort, current retail price snapshots, Add to Cart.
- Competitor/source names remain internal reference metadata; customer-facing shop UI does not render them.

## New customer flow
Browse PC Build & Hardware -> Add to Cart / Buy Now / Request Quote -> Checkout -> Price Confirmation (when required) -> Payment status -> Processing -> Packed -> Shipped -> In Transit -> Delivered -> Completed.

## Main changes
### PC Build & Hardware storefront
- New Hardware shop section inside `/PC-Build/`.
- Search, category filter and price/name sorting.
- Hardware and desktop/custom-PC reference catalogue.
- Existing PC build cards receive Add to Cart, Buy Now and Request Quote actions.
- Floating hardware cart.
- Cart quantity editing/removal.
- Request Quote can be submitted for a single product without replacing the user's existing cart.
- Buy Now goes directly toward checkout.
- Checkout collects customer/contact/address/shipping/payment preference/notes.
- My Orders shows customer-owned orders only and order fulfilment progress.

### Price safety
- External-market prices are reference snapshots, not automatic AZOBSS selling prices.
- Reference-price products use `requiresConfirmation=true`.
- Courier orders also require confirmation so shipping can be confirmed.
- Payment status stays `not-ready` until AZOBSS confirms final price where required.
- No fake/unverified selling price is silently treated as final.

### Current reference snapshot examples (2026-11-01)
- MSI GeForce RTX 5060 8G INSPIRE 2X OC — RM1,599 reference.
- MSI MAG B860M Mortar WiFi — RM969 reference.
- Kingston NV3 PCIe 4.0 NVMe — RM780 reference (variant-dependent listing).
- Samsung 990 PRO PCIe 4.0 NVMe — RM1,240 reference (variant-dependent listing).
- DDR5 5600 notebook RAM — RM700 reference (variant-dependent listing).
- HYTE Y40 White — RM669 reference.
- Acer Aspire Nitro N30-100, Core Ultra 5 225F / RTX 5060 — RM5,519 reference.
- Acer Predator Orion 3000, Core Ultra 5 225F / RTX 5060 — RM6,289 reference.
- EMARQUE i5-14400F / RTX 5070 — RM5,999 reference.
- EMARQUE Ryzen 5 7500F / RTX 5080 — RM12,499 reference.
- EMARQUE Ryzen 7 9800X3D / RTX 5080 — RM14,999 reference.
- NZXT H3 Flow White — RM239 direct-store reference; custom-builder option may differ.
- Phanteks XT M3 — RM279 direct-store reference; custom-builder option may differ.

Prices move; the website labels them as references and requires confirmation when applicable.

## Backend / Firestore
New collection: `pcShopOrders`.

New endpoints:
- POST `/api/pc-shop/orders`
- GET `/api/pc-shop/orders`
- GET `/api/admin/pc-shop/orders`
- PATCH `/api/admin/pc-shop/orders/:orderId`

Customer endpoints require Firebase identity. Customer list endpoint only returns orders belonging to the authenticated UID.

Order numbering:
- Order: `AZO-YYYY-000001`
- Quote: `AZQ-YYYY-000001`
- Invoice: `AZI-YYYY-000001`
- Receipt after paid: `AZR-YYYY-000001`

Quotes can be price-confirmed and converted to an order on the same `AZO` record rather than creating a duplicate order.

## Admin
New `PC Shop Orders` workspace under Admin / Sales & Receipts area.
Admin can:
- search/filter orders;
- confirm final total;
- convert quote to order;
- set payment status;
- set fulfilment status;
- set payment method;
- record shipping charge;
- record courier and tracking number;
- add admin note.

## Sales & Receipts integration
PC/hardware checkout records sync into `purchaseLogs` and are normalized as individual items rather than one generic website-purchase line. This keeps the existing Invoice / Receipt / cost / profit workflow available for PC-shop sales.

## Payment note
v1472 records the selected payment preference (Maybank / CHIP Online Payment / Cash / Other) and supports the order/payment status lifecycle. It does **not** invent a CHIP payment URL or API credential. A live CHIP checkout needs the merchant/API credentials and callback flow to be connected separately if/when available.

## Files added
- `PC-Build/pc-shop-products-v1472.json`
- `PC-Build/retailers/nb-plaza.json`
- `assets/css/azobss-pc-shop-v1472.css`
- `assets/js/azobss-pc-shop-v1472.js`
- `assets/js/azobss-admin-pc-shop-orders-v1472.js`
- `README_PATCH_1472.md`

## Files updated
- `PC-Build/index.html`
- `PC-Build/retailers/index.json`
- `PC-Build/pc-retailers.json`
- `admin/index.html`
- `assets/js/azobss-admin-sales-receipts.js`
- `assets/js/azobss-global-auth.js`
- `backend/server.js`
- global HTML cache-bust references for `azobss-global-auth.js` -> v1472.

## Regression / validation
- Node syntax check: backend server.
- Node syntax check: new customer shop JS.
- Node syntax check: new admin order JS.
- Node syntax check: Sales & Receipts integration JS.
- Node syntax check: global auth JS.
- PC-Build inline JavaScript syntax check.
- Admin inline JavaScript syntax check.
- New/updated JSON parse validation.
- 39 global auth HTML references confirmed at v1472.
- Backend start remains `node server.js`.
- Full ZIP must stay flat/root-ready for Render Root Directory `backend`.
