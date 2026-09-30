# AZOBSS v1109 — PA/BM Download Counter 0/5 → 2/5 Fix

Baseline: `(1108)-AZOBSS-PA-GPS-LOT-KADASTER-EARTH-GPS-MAP-SEARCH_20260913.zip`

Perubahan v1109:
- Betulkan kiraan download PA/BM apabila `downloadCount` ialah `0`: nilai `0` kini dianggap nilai sah dan tidak lagi jatuh kepada alias lama `usedCount` / `downloadsUsed`.
- Selaraskan `downloadCount`, `usedCount`, dan `downloadsUsed` apabila rekod baru dicipta atau kiraan download ditambah.
- Payment/ToyyibPay re-verification pada backend aktif tidak lagi menetapkan semula `downloadCount` rekod sedia ada kepada `0`.
- Serializer Admin, Latest Purchase List, dan My Purchases menggunakan semantik kiraan yang sama dan zero-safe.
- Legacy backend turut mengelakkan payment callback berulang daripada menetapkan semula kiraan sedia ada; rekod baru menginisialisasi semua alias pada `0` bersama-sama.
- Cache-buster `azobss-global-auth.js` dan `azobss-firebase-live-likes-sync.js` dinaikkan ke `v=1109`.

Jangkaan selepas patch:
`0/5 → 1/5 → 2/5 → 3/5 → 4/5 → 5/5`

Nota deploy:
- Render backend **WAJIB redeploy** kerana `deploy-server.js` berubah.
- Upload/deploy fail laman web v1109 supaya bundle frontend `?v=1109` digunakan.
