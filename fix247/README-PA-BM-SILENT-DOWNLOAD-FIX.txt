AZOBSS PA/BM Silent Download Fix

Dibuat:
- Download PA/BM tidak lagi membuka tab onrender.com / Render loading page.
- Semua paid download menggunakan endpoint terkawal /api/pa-bm-download.
- Frontend fetch fail sebagai blob dan terus trigger download di halaman AZOBSS.
- BM/SBM diproxy oleh backend supaya counter 5x/7 hari hanya naik selepas fail berjaya disediakan.
- Counter download masih disimpan dalam Firestore purchaseLogs.
- PA PDF converter kekal digunakan.

Selepas deploy:
1. Deploy website ke GitHub Pages.
2. Redeploy backend Render.
3. Pastikan Build Command Render masih: bash render-build.sh
4. Start Command: node deploy-server.js
