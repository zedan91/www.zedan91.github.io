# AZOBSS Patch 1096 — BM/SBM Map Marker Number + Selection Highlight

Tarikh: 13 September 2026
Package version: 1.0.1096

## Perubahan
- Peta Pilihan BM dan SBM kini memaparkan **Nombor Stesen/BM terus pada setiap pin** menggunakan label kekal.
- Apabila pengguna memilih BM/SBM daripada senarai kanan, pin yang sepadan pada peta turut **dihighlight** dengan saiz/garis lebih jelas dan dibawa ke hadapan.
- Klik pin pada peta masih memilih item yang sama dalam senarai dan memaparkan butiran serta butang Tambah ke Troli.
- Pemilihan pertama selepas carian turut menyelaraskan highlight senarai dan pin.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke v1096.
- Tiada perubahan backend, pembayaran, PA resolver, GPS, Syit Piawai atau Lot Kadaster.

## Deploy
Perubahan frontend sahaja. Push GitHub Pages seperti biasa; Render backend tidak perlu redeploy khusus untuk patch ini.
