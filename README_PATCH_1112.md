# AZOBSS v1112 — PA/BM/SBM/GPS WGS84 Preserve Zoom Fix

Baseline:
`(1111)-AZOBSS-PA-BM-DOWNLOAD-EXACT-ONCE-COUNTER-FIX_20260914.zip`

Masalah:
Apabila pengguna menetapkan lokasi WGS84 terus pada peta:
- PA: single-click
- BM / SBM: double-click
- GPS: double-click

peta menjalankan `fitBounds()` / `setView()` selepas hasil carian keluar, lalu zoom semasa pengguna berubah atau zoom-out.

Pembetulan v1112:
- PA: single-click WGS84 mengekalkan zoom semasa.
- BM: double-click WGS84 mengekalkan zoom semasa.
- SBM: double-click WGS84 mengekalkan zoom semasa.
- GPS: double-click WGS84 mengekalkan zoom semasa.
- Titik WGS84 baharu dipusatkan pada peta menggunakan zoom semasa pengguna.
- Auto `fitBounds()` hanya dielakkan untuk tindakan menetapkan WGS84 terus pada peta.
- Carian melalui kotak input / Nombor Lot / Nombor PA kekal dengan tingkah laku auto-fit sedia ada.
- Klik manual pada hasil BM/SBM/GPS masih boleh memfokuskan origin + stesen seperti sebelumnya.
- Klik hasil PA masih boleh memfokuskan lot seperti sebelumnya.
- Fungsi lain tidak diubah.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke `v1112`.

Deploy:
- Perubahan v1112 sendiri ialah frontend sahaja.
- Jika backend v1111 untuk exact-once download counter belum dideploy ke Render, backend v1111 masih perlu dideploy.
