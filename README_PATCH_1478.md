# AZOBSS v1478 — PC Shop Render Runtime Alignment & Capability Handshake

## Root cause fixed
The customer-facing PC Build & Hardware frontend calls `https://azobss-backend.onrender.com`.
That Render service starts **`node deploy-server.js`** (Docker runtime), not `backend/server.js`.
PC Shop routes existed in `backend/server.js`, but were missing from `deploy-server.js`, so the live backend returned 404/405 for `/api/pc-shop/*` even when the frontend was already v1477.

## v1478 architecture
- Primary Render PC Shop runtime: `deploy-server.js`
- PC Shop route implementation: `lib/azobss-pc-shop-runtime.js`
- Secondary/compatibility implementation remains in `backend/server.js`
- API compatibility is identified by `apiVersion: "pc-shop-v1"` + capabilities instead of strict frontend/backend release-number equality.
- Health check is lightweight and does **not** scrape/sync retailer prices.
- Live retailer pricing remains in `/api/pc-shop/catalog` with cache + markup.

## Runtime routes now provided by deploy-server.js
- `GET /api/pc-shop/health`
- `GET /api/pc-shop/catalog`
- `POST /api/pc-shop/orders`
- `GET /api/pc-shop/orders`
- `GET /api/admin/pc-shop/catalog`
- `GET /api/admin/pc-shop/orders`
- `PATCH /api/admin/pc-shop/orders/:orderId`

## Health contract
Expected response includes:
```json
{
  "ok": true,
  "release": "1478",
  "apiVersion": "pc-shop-v1",
  "capabilities": {
    "catalog": true,
    "orders": true,
    "adminOrders": true,
    "livePricing": true,
    "markup": true,
    "maybankOnly": true,
    "salesReceiptSync": true
  },
  "runtime": "deploy-server.js"
}
```

## Frontend improvements
- Checkout checks backend **capability**, not exact release number.
- Checkout shows `Server order: Sedia` when the runtime is compatible.
- If the runtime API is missing, Place Order is disabled with a clear Retry status instead of failing only after submission.
- No stale message such as “backend belum menggunakan v1476”.
- `Place Order`, `My Orders`, catalog, markup, Maybank-only checkout, and modal v1477 stability remain.

## Render build filter
`render.yaml` now watches:
- `PC-Build/pc-shop-products-v*.json`
- `PC-Build/pc-build-data.json`
- `PC-Build/retailers/**`

This ensures future PC Shop/catalog backend-runtime changes trigger an automatic Render rebuild.

## Pricing/payment retained
- Source/reference prices remain internal.
- Customer price is generated with AZOBSS markup server-side.
- Maybank remains the only payment method for new PC Build & Hardware checkout.
- Existing historical payment method values are not rewritten.

## Deployment
The full archive is root-ready. After replacing/merging repository contents, Render service `azobss-backend` should auto-deploy because `deploy-server.js` and `lib/**` changed.

Verify after deploy:
`https://azobss-backend.onrender.com/api/pc-shop/health`

The important checks are `ok:true`, `apiVersion:"pc-shop-v1"`, and `capabilities.orders:true`; future compatible releases do not need to match the frontend release number exactly.
