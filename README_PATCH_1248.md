# AZOBSS Patch 1248 — Pending Payment Cart Ready Race Fix

- Membetulkan popup `Sistem troli belum tersedia. Muat semula halaman dan cuba lagi.` apabila pengguna menekan **Tambah Semula** terlalu awal.
- `azobss-pabm-storefront.js` sekarang menerbitkan API `window.azobssPaBmStoreCart` seawal permulaan `init()`, sebelum menunggu asynchronous user price adjustment.
- Storefront menghantar event `azobss:pabm-store-cart-ready` apabila API troli tersedia.
- `azobss-global-auth.js` sekarang menunggu API troli sehingga 15 saat dan boleh memaksa import modul storefront v1248; pengguna tidak lagi perlu refresh halaman hanya kerana race condition startup.
- Semasa proses, butang **Tambah Semula** memaparkan `Memuat...` dan kekal disabled untuk mengelakkan double click.
- Flow backend `POST /api/pa-bm/pending-cart-action`, resume bill ToyyibPay yang sama, dan remove Pending Payment v1246/v1247 dikekalkan.

Package version: `1.0.1248`
