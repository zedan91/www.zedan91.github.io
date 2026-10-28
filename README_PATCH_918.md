# AZOBSS Patch 918 — Sinkron Diskaun Lot Kadaster Ketika Checkout

Tarikh: 15 Ogos 2026

Perubahan:
- Membetulkan checkout `Lot Kadaster Berdigit` / `NDCDB` apabila akaun mempunyai pelarasan harga khusus, contohnya `-40%`.
- Backend kini menggunakan `usernameKey` daripada sesi pengguna hanya sebagai petunjuk untuk mencari dokumen `users/<username>`, kemudian **mengesahkan UID/e-mel Firebase** sebelum mengambil tetapan harga. Nilai harga daripada browser tetap tidak dipercayai sebagai sumber harga.
- Ini mengelakkan backend tersalah menggunakan rekod pengguna pendua/rekod lama yang mempunyai UID sama tetapi tiada tetapan `Lot Kadaster Berdigit (%)`.
- Harga ToyyibPay, jumlah pesanan dan rekod pembelian kini menggunakan harga selepas pelarasan yang sama seperti troli. Contoh RM44 dengan `-40%` menjadi RM26.40.
- Checkout capability dinaikkan daripada v8 kepada v9 supaya frontend tidak meneruskan pembayaran menggunakan backend lama yang belum mempunyai pembetulan ini.
- Cache `azobss-pabm-storefront.js` dinaikkan ke `v=918`.
- `backend/server.js` alternatif turut menerima resolver profil yang sama untuk konsistensi.
