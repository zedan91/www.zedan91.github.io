# AZOBSS Patch 1100 — Animated Search Loading for PA / BM / SBM

Package version: 1.0.1100

## Perubahan
- Menambah loading bergerak pada Peta Pilihan PA, BM dan SBM semasa carian sedang diproses.
- Bar status kanan memaparkan spinner berputar dan progress bar bergerak bersama teks khusus seperti `Mencari Lot ...`, `Mencari BM terdekat...` atau `Mencari SBM terdekat...`.
- Butang `Cari` turut bertukar kepada spinner + `Mencari Lot...`, `Mencari BM...` atau `Mencari SBM...` dan dikunci sementara request masih berjalan.
- Loading berhenti automatik apabila carian berjaya, gagal atau request dibatalkan.
- Logik carian, backend, harga, troli dan pembayaran tidak diubah.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke v1100.
- Tidak memerlukan redeploy Render kerana perubahan ini frontend sahaja.
