# AZOBSS v1480 — Verified Price Only + PC Build / Hardware Separation + Performance

## Tujuan
v1480 meneruskan baseline penuh v1479 dan membetulkan UX PC Build supaya customer tidak lagi melihat kad PC/hardware dengan harga anggaran, `Semak harga akhir`, atau item sumber yang gagal disahkan.

## PC Builds (katalog utama)
- Bahagian katalog dinamakan jelas sebagai **PC Builds — Harga Disahkan Sahaja**.
- Sumber retailer aktif dikurangkan kepada 10 katalog yang mempunyai produk berharga; 6 katalog quote/no-price dibuang daripada katalog aktif.
- 121 produk retailer berharga kekal dan hanya dipaparkan jika `priceVerified=true`, `sourceUrl` wujud, harga positif dan snapshot tidak terlalu lama (maksimum 14 hari).
- AZOBSS builds tidak dipaparkan menggunakan harga statik/anggaran. Ia hanya muncul selepas `/api/pc-build/live-prices` berjaya mengesahkan harga semasa dan availability.
- Jika live source gagal, produk AZOBSS berkenaan disembunyikan daripada customer.
- `Semak harga akhir` dibuang. Build Sendiri kekal sebagai flow **Minta Sebut Harga** tanpa memaparkan nombor anggaran.

## Fix `Semua sumber` / performance
- Grid hanya render maksimum 12 kad pada satu masa.
- Pagination atas + bawah.
- Search debounce 180ms.
- Filter render dicoalesce dengan `requestAnimationFrame`.
- `azobss-pc-retailers.js` tidak lagi memasang listener berat yang menduplikasi setiap main-filter render.
- Shared PC link auto memilih page yang mengandungi kad tersebut.

## Hardware Shop
- G3 ditukar daripada `PC Build & Hardware Shop` kepada **Hardware Shop**.
- Desktop/laptop/custom PC tidak lagi diulang di Hardware Shop; PC Build kekal di katalog PC Builds.
- Tab menjadi Hardware + shortcut `PC Builds ↓` + My Orders.
- Hardware customer hanya dipaparkan apabila backend mengesahkan `live`, harga positif dan `available=true`.
- Tiada snapshot fallback kepada customer jika live sync gagal.
- Checkout backend menolak item yang tidak lagi mempunyai harga live disahkan.
- HTML product availability turut dikesan; `Out-of-Stock` / `Sold out` disembunyikan.

## Katalog Hardware v1480
Fail aktif: `PC-Build/pc-shop-products-v1480.json`.
Produk aktif sengaja ketat dan single-price:
- MSI GeForce RTX 5070 12G VENTUS 2X OC
- MSI MAG B860M Mortar WiFi
- HYTE Y40 ATX Case - White
- Phanteks XT M3 mATX Case - Black

Dikeluarkan daripada paparan aktif:
- MSI RTX 5060 Inspire — source out-of-stock.
- Samsung 990 PRO, Kingston NV3, DDR5 5600 Notebook RAM — harga bergantung kapasiti/varian dan kad lama tidak mempunyai pemilihan kapasiti yang cukup jelas.
- NZXT H3 Flow White — source menunjukkan sold-out semasa semakan.
- Semua desktop/laptop dari katalog Hardware — dipisahkan ke PC Builds.

## v1479 dikekalkan
- Deferred invoice lifecycle.
- Courier address wajib.
- Duplicate order protection.
- Repair Premature Invoices.
- Maybank-only PC Shop flow.

## Deploy
ZIP FULL v1480 adalah root-ready: `index.html`, `backend/`, `lib/`, `assets/`, `PC-Build/`, `admin/` berada terus di root archive.
