# AZOBSS v1478 — PC Shop Render Runtime Alignment & Capability Handshake

v1478 aligned the PC Build & Hardware API with the actual Render entrypoint (`node deploy-server.js`).

- Primary Render runtime: `deploy-server.js`
- PC Shop route module: `lib/azobss-pc-shop-runtime.js`
- Compatibility backend remains in `backend/server.js`
- API compatibility: `apiVersion: "pc-shop-v1"` + capability flags
- Live catalog: `/api/pc-shop/catalog`
- Orders: `/api/pc-shop/orders`
- Admin orders: `/api/admin/pc-shop/orders`

This file is retained as baseline history inside later full packages.
