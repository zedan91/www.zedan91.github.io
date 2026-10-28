# AZOBSS v1251 — PA/BM Cart + State Picker Hard Fix

## Fix 1 — Add to Cart masuk Troli Anda dengan betul
Punca utama ialah nama global `window.azobssRecordPurchase` dikongsi oleh dua fungsi berbeza: writer `purchaseLogs` lama dan fungsi PA/BM cart. Bergantung pada masa module siap, writer lama boleh mengambil alih nama itu semula, menyebabkan butang PA/BM tidak memasukkan item ke `Troli Anda`.

v1251 memisahkan fungsi tersebut:
- `window.azobssCreatePurchaseLog` = writer purchase log lama.
- `/PA-BM/` tidak lagi membenarkan global auth/live-likes mengambil alih `window.azobssRecordPurchase`.
- Storefront menerbitkan dedicated cart handler `window.__AZOBSS_PABM_CART_RECORD_PURCHASE__`.
- Search PA, BM/SBM, GPS, Syit Piawai dan map flow menggunakan `window.azobssAddToPaBmCart()` yang menunggu cart API sehingga ready, bukan memanggil global purchase logger yang ambigu.

## Fix 2 — Pilih Negeri sentiasa button-grid, bukan dropdown
- CSS storefront dibump cache kepada `v=1251` (sebelum ini URL CSS masih `v=1126`, jadi browser boleh menggunakan CSS lama).
- State `<select>` ditandakan `pabm-state-select` dan disembunyikan secara visual tanpa bergantung pada async storefront readiness.
- Semua negeri dipre-render sebagai button-grid dalam HTML supaya terus nampak.
- `azobss-pabm-early-bridge.js` mengaktifkan grid negeri sebelum module/Firebase selesai load.
- Storefront reuse binding awal dan tidak memasang listener berganda.

## Dikekalkan
- v1250 failed/cancelled payment kekal dalam Troli Anda.
- Pending/cancelled/failed tidak dipaparkan dalam Senarai Pembelian Terkini.
- Hanya paid/verified masuk Senarai Pembelian Terkini.
- Harga, negeri, PA/BM search, Lot Kadaster, ToyyibPay backend dan download flow tidak diubah selain wiring cart/cache di atas.
