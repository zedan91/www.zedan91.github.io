# AZOBSS v1090 — Lot Kadaster Friendly Download Filename

Baseline: v1089. Package version: `1.0.1090`.

## Perubahan
- Nama fail Lot Kadaster ZIP, DXF dan DWG tidak lagi menggunakan JUPEM Job ID yang panjang.
- Format baharu: `LotKadasterBerdigit-YYYY-MM-DD-h.mmam-11.73percent.ext`.
- Tarikh dan masa menggunakan waktu Malaysia (`Asia/Kuala_Lumpur`) pada masa muat turun sebenar.
- Nilai `percent` menggunakan nisbah keluasan pilihan yang sama seperti dipaparkan pada Senarai Pembelian Terkini.
- Contoh: `LotKadasterBerdigit-2026-09-10-10.34am-11.73percent.dxf`.
- Format yang sama digunakan untuk `.zip`, `.dxf` dan `.dwg`.
- ZIP kini distrim melalui endpoint attachment AZOBSS supaya `Content-Disposition` boleh menetapkan nama fail yang mesra pengguna; fail tidak dibuffer sepenuhnya dalam JavaScript browser.
- Kuota download hanya ditambah selepas backend mengesahkan sumber JUPEM benar-benar ZIP yang sah.
- Cache-buster untuk `azobss-global-auth.js` dan `azobss-firebase-live-likes-sync.js` dinaikkan ke `v=1090`.

Tiada perubahan pada harga, pemilihan lot, formula nisbah keluasan, pembayaran, atau had 5 download / 7 hari.
