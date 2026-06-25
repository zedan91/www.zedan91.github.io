AZOBSS PA/BM Download Limit 5x 7 Days - Final Fix

Dibuat:
- Download button dalam Latest Purchase List tidak lagi buka /api/pa-bm-download secara terus.
- Page login akan semak status paid, had 5 kali, dan tempoh 7 hari sebelum buka link download sebenar.
- Download counter disimpan dalam Firestore purchaseLogs.
- Jika Render belum ada Firebase Admin service account, download tidak lagi keluar JSON "Download verification failed".
- Nota limit download kekal dalam Latest Purchase List.
- Fail rules baru disediakan:
  FIREBASE-RULES-AZOBSS-PA-BM-DOWNLOAD-LIMIT-5X-7D-FINAL.txt

Penting:
1. Deploy ZIP ini ke GitHub Pages/Render seperti biasa.
2. Publish rules baru di Firebase Console > Firestore Database > Rules.
3. Render backend masih boleh guna untuk PA PDF converter.
4. Build Command Render kekal: bash render-build.sh
5. Start Command Render kekal: node deploy-server.js
