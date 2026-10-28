# AZOBSS v1315 — Website Version Badge + Global Auth Cache Fix

- Fix label versi Administrator yang masih memaparkan `v1307`.
- Punca: `assets/js/azobss-global-auth.js` masih hard-coded `VERSION_TEXT = 'v1307'`.
- Badge kini memaparkan `v1315`.
- Semua rujukan HTML kepada `azobss-global-auth.js` dinaikkan cache-buster ke `?v=1315` supaya browser tidak memuatkan salinan lama.
- Regression test lama yang secara tidak sengaja mengunci `v1307` telah dibetulkan dan test khusus v1315 ditambah.
- Tiada perubahan kepada Debt & Loan v1314 selain nombor versi/cache shared auth.
