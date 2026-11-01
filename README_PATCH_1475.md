# AZOBSS v1475 — PC Shop Live Price + Final Selling Price + Checkout Recovery

Date: 2026-11-01
Baseline: v1474

## 1. Checkout / Order failure hardening
- `/api/pc-shop/orders` remains the canonical order creator.
- Order is saved to `pcShopOrders` first.
- Sync to `purchaseLogs` / Sales & Receipts is now non-fatal. If that secondary sync fails, the customer still receives a successful Order ID.
- Added `/api/pc-shop/health` with backend version `1475`.
- Frontend now gives explicit messages for 404/405 backend version mismatch, 401 login, and 503 backend/Firestore unavailable instead of only `Order gagal dibuat`.
- Customer order submit allows a longer cold-start window and changes the button text to `Server sedang aktif…` after a short delay.

## 2. Live source price architecture
Public shop no longer treats static competitor/source snapshots as the customer selling price.

Flow:
`source page -> AZOBSS backend live price cache -> server-side markup -> final AZOBSS selling price -> customer`

- Public endpoint: `GET /api/pc-shop/catalog`
- Admin endpoint: `GET /api/admin/pc-shop/catalog?refresh=1`
- Default live-price cache: 10 minutes (`PC_SHOP_PRICE_CACHE_MS`).
- Sources are fetched server-side, so source/cost metadata does not need to be shown in customer UI.
- EMARQUE Shopify product URLs use Shopify product JSON where possible.
- Collection/category pages and NB Plaza pages use title/model matching + nearby RM price extraction.
- Suspicious variant mismatches are rejected when a fetched live price is <50% or >180% of the current snapshot; the item falls back to snapshot mode and requires confirmation.

## 3. AZOBSS markup policy
Markup is deterministic and calculated server-side.

Rate tiers:
- <= RM2,500: 15%
- <= RM4,000: 12%
- <= RM6,000: 10%
- <= RM8,000: 9%
- <= RM10,000: 8%
- > RM10,000: 7%

Minimum markup:
- Parts / hardware: RM150
- PC / desktop / laptop: RM250

Final selling price is rounded up to the next RM10.

Examples:
- RM780 part -> RM930 selling
- RM1,599 GPU -> RM1,840 selling
- RM5,519 desktop -> RM6,080 selling
- RM6,399 custom PC -> RM6,980 selling

## 4. Customer pricing UI
- Product cards now show final AZOBSS selling price.
- Live status label: `Harga jual AZOBSS • live ...`
- If live source validation fails: `Harga jual sementara • sumber perlu semakan`.
- Cart now uses `Item subtotal` / `Harga jual AZOBSS`, not `Reference subtotal` for valid live items.
- Courier is separated from item price. Product prices can be final while courier charge remains pending.
- Pickup has RM0 shipping.

## 5. Existing PC Build retailer cards
Verified retailer snapshot cards are now passed through AZOBSS markup before public display.
Admin retains internal source cost + markup visibility.

## 6. Admin PC Shop Orders
- Item rows show source cost -> markup -> selling price.
- Added `Sync Harga Sekarang` button.
- Added `shipping-confirmation` filter/status support.
- Shipping charge and item selling total are handled separately.

## 7. Catalog
New canonical curated catalog:
`PC-Build/pc-shop-products-v1475.json`

- 20 curated products retained.
- Added source matching hints for live extraction.
- Updated Ryzen 5 7500F / RTX 5070 EMARQUE snapshot to RM6,399 based on current source result.
- NZXT H3 Flow and Phanteks XT M3 source URLs changed to exact EMARQUE product pages.

## 8. Validation
- `backend/server.js`: Node syntax check passed.
- `assets/js/azobss-pc-shop-v1475.js`: Node syntax check passed.
- `assets/js/azobss-admin-pc-shop-orders-v1475.js`: Node syntax check passed.
- `assets/js/azobss-global-auth.js`: Node syntax check passed.
- PC-Build inline JS: syntax check passed.
- Admin inline JS: 19 blocks passed.
- `pc-shop-products-v1475.json`: valid JSON.
- 39 HTML pages reference `azobss-global-auth.js?v=1475`.
- Global version badge: v1475.

## Deployment
ZIP must be deployed with root contents directly visible:
- `index.html`
- `assets/`
- `backend/`
- `PC-Build/`
- etc.

Render Root Directory remains `backend`.
