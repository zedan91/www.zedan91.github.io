# AZOBSS Patch 1126 — PA Preview Above Map Modal

Package version: `1.0.1126`

## Fix
- Membetulkan butang kanta pada **Peta Pilihan PA** apabila pratonton `LIHAT PA` terbuka di belakang modal peta.
- Punca: modal peta menggunakan `z-index: 2147483100`, manakala modal pratonton PA mewarisi `z-index: 2147483000`.
- Modal pratonton PA (`.pabm-pa-modal`) kini menggunakan `z-index: 2147483640`, jadi gambar PA, metadata dan Senarai Lot sentiasa muncul di hadapan peta.
- Modal Syit Piawai biasa tidak diubah.
- Cache-buster `azobss-pabm-storefront.css` pada `/PA-BM/` dinaikkan ke `v1126`.

## Deploy
Frontend sahaja. Jika backend v1124+ sudah aktif, Render tidak perlu redeploy.
