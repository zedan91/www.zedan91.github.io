# AZOBSS v1114 — Successful Download False Error Popup Fix

Baseline:
`(1113)-AZOBSS-BM-SBM-LOCK-SELECTED-STATION-WGS84-FIX_20260914.zip`

Masalah:
Fail boleh berjaya dimuat turun tetapi popup berikut masih muncul:
`Download sedang disediakan atau server sedang bangun. Sila cuba semula sebentar lagi.`

Punca:
Frontend mempunyai dua laluan untuk butang paid download:
1. document capture handler; dan
2. inline `onclick` pada link yang turut memanggil `azobssClientControlledDownload()`.

Ia redundant dan boleh menghasilkan re-entry/request kedua pada sesetengah keadaan browser/render semula.
Selain itu generic `catch` menganggap semua JavaScript exception sebagai kegagalan download,
walaupun browser mungkin sudah menerima arahan download.

Pembetulan v1114:
- Buang inline `onclick` redundant pada paid-download links.
- Document capture handler menjadi satu-satunya pemilik klik download.
- Tambah `azobssClickClaimed` guard untuk menghalang re-entry bagi klik yang sama.
- Tambah `downloadTriggered` state.
- Selepas blob berjaya dihantar ke browser melalui `a.click()`, sebarang exception UI selepas itu
  tidak lagi memaparkan popup kegagalan yang mengelirukan.
- Error sebenar sebelum download bermula masih memaparkan popup seperti biasa.
- Cache-buster `azobss-global-auth.js` dan `azobss-firebase-live-likes-sync.js` dinaikkan ke v1114.

Deploy:
- v1114 ialah perubahan frontend.
- Backend exact-once daripada v1111 masih mesti sudah dideploy pada Render untuk memastikan
  counter tidak berganda jika request sebenar diulang di rangkaian/backend.
