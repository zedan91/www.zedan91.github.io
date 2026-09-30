# AZOBSS v1110 — PA Single-Click WGS84 Map Search

Baseline: `(1109)-AZOBSS-PA-BM-DOWNLOAD-COUNTER-0-TO-2-FIX_20260914.zip`

Perubahan v1110:
- **PA sahaja**: Peta Pilihan PA tidak lagi memerlukan double-click untuk menetapkan titik carian WGS84 baharu.
- Satu klik pada lokasi kosong di peta kini terus mengisi koordinat WGS84 dan menjalankan carian PA/lot pada lokasi tersebut.
- Klik pada polygon lot hasil carian masih memilih lot tersebut dan tidak mencetuskan carian WGS84 baharu.
- Teks bantuan PA ditukar kepada `Klik sekali lokasi pada peta untuk menetapkan titik carian WGS84 baharu.`
- BM/SBM dan GPS **tidak diubah**; tingkah laku double-click sedia ada kekal.
- Cache-buster `azobss-pabm-map-search.js` pada `/PA-BM/` dinaikkan ke `v1110`.

Deploy:
- Frontend sahaja perlu push/deploy.
- Render backend **tidak perlu redeploy** untuk perubahan v1110.
