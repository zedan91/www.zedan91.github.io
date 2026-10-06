# AZOBSS v1139 — Purchase Records Auto-Hide / Reset Race Fix

Baseline:
`(1138)-AZOBSS-ADMIN-PURCHASE-RECORDS-TEST-DOWNLOAD-CUSTOMER-POV-FIX_20260916.zip`

Punca sebenar:
- `/PA-BM/` memuatkan `azobss-global-auth.js` dan `azobss-firebase-live-likes-sync.js` serentak.
- v1138 sudah menghalang live-sync daripada bind renderer kedua, tetapi beberapa `window.*` Purchase Records handlers masih dioverwrite oleh live-sync.
- Antaranya Reset 0/5, Test/customer controlled download, Show/Hide detail, delete dan pagination.
- Jadi klik boleh berjalan melalui live-sync state, tetapi refresh berikutnya dirender oleh global-auth state. Hasilnya kad yang sedang terbuka boleh auto-hide dan selepas Reset 0/5 UI kadang-kadang kelihatan seperti tidak reset / berubah balik.

Pembetulan v1139:
- `azobss-global-auth.js` ditetapkan sebagai single canonical owner Purchase Records seawal module load.
- Live-sync tidak lagi overwrite handler Purchase Records apabila global-auth wujud.
- Reset 0/5, Test Download, Show/Hide, Delete, detail pagination dan manual refresh semuanya kekal pada owner yang sama.
- Open/closed state dan detail-page state dikongsi melalui global state sebagai perlindungan tambahan terhadap re-render.
- Live-sync masih kekal aktif untuk fungsi live sync lain; hanya pemilikan Purchase Records dipisahkan.
- Cache-buster kedua-dua auth JS pada `/PA-BM/` dinaikkan ke v1139.

Expected result:
1. Buka kad user -> kekal terbuka walaupun Test/Reset menyebabkan refresh.
2. Tekan Reset 0/5 -> backend reset sekali dan UI tidak dilawan oleh renderer kedua.
3. Test Download -> counter refresh tanpa menutup kad secara rawak.

Deploy:
- v1139 ialah frontend-only fix.
- Backend v1137/v1138 sedia ada tidak perlu redeploy untuk patch ini.
