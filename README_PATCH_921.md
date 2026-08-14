# Patch 921 — Admin Test Payment Discount Checkout Sync

- Membetulkan popup `Jumlah pembayaran tidak sepadan` yang masih muncul ketika **Admin Test Payment** untuk Lot Kadaster yang mempunyai pelarasan harga pengguna.
- Punca sebenar: route `/api/admin/test-pa-bm-payment` pada `deploy-server.js` menggunakan harga asas Lot Kadaster yang disahkan JUPEM tetapi tidak menggunakan diskaun per-user yang sama seperti troli/ToyyibPay biasa. Contoh RM13 dengan -40% dipaparkan RM7.80 di troli tetapi route ujian masih memulangkan RM13.
- Admin Test kini hydrate profil Firestore tepat melalui `priceProfileDocId`, mengesahkan ia milik UID/e-mel login, kemudian menggunakan `lotKadaster` / `paBm` price adjustment yang sama.
- Response dan rekod test payment kini menyimpan `baseAmount`, `saleAmount`, `priceAdjustmentPercent` dan `priceAdjustmentByCategory`.
- Ditambah semakan `expectedAmountSen` pada Admin Test supaya rekod paid tidak dicipta jika frontend/backend masih tidak selari.
- Frontend Admin Test kini memanggil checkout capabilities dahulu; minimum backend dinaikkan ke **v11**. Ini menghalang backend lama daripada menghasilkan test order pada harga asal.
- `backend/server.js` alternatif turut diselaraskan.
