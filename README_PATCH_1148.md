# AZOBSS v1148 — Download Health / Fallback / Counter Integrity Fix

Baseline: `(1147)-AZOBSS-DOWNLOAD-KEEP-PA-BM-PAGE-HIDDEN-ATTACHMENT-FRAME-FIX_20260916.zip`

Pembetulan utama:
- Betulkan bug hostname Render dalam `azobssWaitForDownloadBackendReady()`. v1147 menggunakan RegExp literal yang terlebih escape dan boleh menganggap `azobss-backend.onrender.com` sebagai bukan Render, lalu `/health` ter-skip. v1148 guna exact hostname comparison.
- Betulkan pemeriksaan hostname yang sama pada browser fallback.
- Semua controlled fallback kini kekal di `/PA-BM/`; tiada lagi `window.location.href` ke Render/JUPEM dalam capture download. Delivery fallback dibuat melalui hidden attachment frame.
- Legacy download row yang hanya ada URL (tiada payload) kini melalui spinner + `/health` gate + hidden delivery yang sama.
- PA native download hanya menanda `downloadTriggered=true` selepas hidden attachment trigger berjaya.
- Hidden attachment frame assign URL secara synchronous selepas frame dimasukkan, jadi return `true` benar-benar bermaksud URL trigger sudah dipasang.
- Backend PA/BM download kini fail-closed jika Firestore quota counter gagal ditulis untuk PA, GPS, Syit Piawai dan BM/SBM; fail tidak dihantar jika quota tidak berjaya direkod.
- Browser fallback BM/SBM/PA membawa `downloadAttemptId` yang sama supaya retry satu klik tidak menghabiskan quota dua kali.
- Buang CSS spinner pseudo-element v1144 yang sudah obsolete; spinner DOM v1146 kekal sebagai single visual owner.
- Buang `azobss-render-smart-prewarm-v1040.js` khusus daripada halaman PA/BM kerana `azobss-render-wake.js?v=1056` + forced early wake v1145 sudah menjadi wake owner.
- Cache-buster `azobss-global-auth.js` dan `azobss-firebase-live-likes-sync.js` dinaikkan ke v1148.

Flow v1148:
`Masuk /PA-BM/ -> early /health wake -> tekan Download/Test -> spinner button -> wajib tunggu /health ok -> backend verify purchase/quota -> counter transaction exact-once -> hidden/native attachment atau blob download -> refresh counter.`

Deploy:
- Frontend + backend berubah.
- Push keseluruhan package ke GitHub Pages repo.
- Render `azobss-backend` WAJIB redeploy daripada build v1148 kerana quota-counter/fallback backend turut berubah.
- Selepas frontend deploy, hard refresh `Ctrl + Shift + R`.
