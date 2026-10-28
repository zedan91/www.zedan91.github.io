# AZOBSS v1111 — PA/BM Exact-Once Download Counter Fix

Baseline: `(1110)-AZOBSS-PA-SINGLE-CLICK-WGS84-MAP-SEARCH_20260914.zip`

Masalah:
- Selepas admin Reset 0/5, satu klik Download masih boleh terus kelihatan sebagai 2/5.
- Dua punca yang kini ditutup:
  1. rekod legacy boleh mempunyai alias counter yang tidak sepadan;
  2. request GET yang sama boleh berlaku lebih daripada sekali kerana browser/navigation/retry.

Pembetulan v1111:
- `downloadCount` kekal authoritative termasuk nilai 0.
- Counter backend kini menggunakan Firestore transaction supaya increment dibaca daripada nilai semasa, bukan snapshot lama.
- Setiap klik Download menghasilkan `downloadAttemptId` unik.
- Backend menyimpan `lastDownloadAttemptId`; request/retry dengan ID klik yang sama TIDAK increment kali kedua.
- Semua alias `downloadCount`, `usedCount`, `downloadsUsed` diselaraskan kepada nilai yang sama setiap increment.
- Berlaku untuk PA, BM/SBM, GPS, Syit Piawai dan Lot Kadaster yang menggunakan `/api/pa-bm-download`.
- PA/BM frontend cache-buster `azobss-global-auth.js` dan `azobss-firebase-live-likes-sync.js` dinaikkan ke v1111.

Hasil yang dikehendaki:
0/5 -> 1/5 -> 2/5 -> 3/5 -> 4/5 -> 5/5

PENTING:
- `deploy-server.js` berubah, jadi Render backend WAJIB redeploy.
- Selepas Render selesai, push/deploy frontend dan hard refresh browser.
