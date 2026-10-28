# AZOBSS Patch 1265 — Server Cart Draft / Full Browser Restart Recovery

## Diagnosis sebenar
v1264 masih bergantung pada dua sumber yang tidak cukup kukuh selepas **seluruh browser** ditutup:

1. `localStorage` / payment-cart backup. Dalam Incognito/Private mode, semua storage ini memang boleh hilang apabila semua private windows ditutup.
2. `/api/pa-bm/payment-recovery` membaca `premiumOrders`, tetapi loader recovery lama **secara eksplisit membuang status `cancelled`, `failed`, `rejected`**. Ini bercanggah dengan flow yang dikehendaki: pembayaran gagal/cancel mesti kekal sebagai cart, bukan purchase history.

Akibatnya, bila local cart hilang selepas browser restart dan ToyyibPay telah menandakan cubaan sebagai cancelled/failed, backend sendiri menapis keluar order yang sepatutnya digunakan untuk membina semula cart.

## Fix v1265
- Tambah Firestore collection `paBmCartDrafts`, satu cart draft per Firebase UID.
- Semasa `/api/toyyib/create-pa-bm-bill` berjaya / reuse pending bill, backend menyimpan snapshot item cart **sebelum redirect ToyyibPay**.
- Storefront juga sync perubahan cart secara best-effort melalui `/api/pa-bm/cart-draft` (POST/DELETE), tanpa mengganggu Add to Cart lokal.
- `/api/pa-bm/payment-recovery` semak UID-keyed server cart draft **terlebih dahulu**, jadi recovery tidak bergantung pada localStorage atau username hydration timing.
- `cancelled / canceled / failed / rejected / expired / void / declined` kini dianggap **recoverable cart state**, bukan dibuang daripada recovery scan.
- Jika bill masih `pending/unpaid/processing`, cart dipulihkan dan checkout boleh sambung bill ToyyibPay yang sama.
- Jika cubaan sudah `cancelled/failed/...`, item tetap dipulihkan tetapi metadata resume bill lama tidak digunakan; checkout seterusnya akan cipta/reuse bill yang sah.
- Apabila bayaran benar-benar `paid/verified`, server cart draft dikosongkan supaya item tidak muncul semula.
- Pending/failed/cancelled tetap **tidak masuk Senarai Pembelian Terkini** kerana `purchaseLogs` hanya dibuat selepas paid/verified.

## Regression protection
- Inline classic cart core v1259 dikekalkan byte-identical.
- `addToStoreCart()` dikekalkan byte-identical berbanding v1264.
- Pilihan negeri/highlight, checkout secure token, dan paid-only purchase history dikekalkan.

Package version: `1.0.1265`
