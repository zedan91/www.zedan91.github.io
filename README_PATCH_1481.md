# AZOBSS v1481 — Hardware Shop Startup + Cart Modal Recovery

Base: v1480 FULL.

## Fixed
- Restores the proven PC Shop modal lifecycle functions accidentally omitted in v1480: `cleanupPcShopModalState`, `modal`, and `closeModal`.
- Hardware Shop no longer stops at “Menyemak harga hardware live…” because startup can continue into `loadCatalog()`.
- Floating hardware cart opens its modal again, including empty-cart, quantity, checkout and My Orders flows.
- Startup is defensive: modal cleanup failures cannot block live catalog loading.
- Strict v1480 verified-price policy remains unchanged: no snapshot/unverified/out-of-stock hardware is shown to customers.
- PC Builds pagination/performance and verified-price-only filtering remain unchanged.
- v1479 deferred invoice, Courier address requirement, duplicate guard and premature-invoice repair remain preserved.

## Deployment
This is a full root-ready package. Replace repository contents with the v1481 FULL archive. Render can continue using `deploy-server.js`.
