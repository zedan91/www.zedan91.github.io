# AZOBSS v1140 — Download Backend Wake Spinner Fix

Baseline: `(1139)-AZOBSS-PURCHASE-RECORDS-AUTO-HIDE-RESET-RACE-FIX_20260916.zip`

Masalah:
- Render Free boleh spin down selepas idle.
- Klik download pertama selepas lama tidak digunakan boleh menavigasi browser terus ke halaman Render `SERVICE WAKING UP`.

Pembetulan v1140:
- Sebelum paid PA/BM/SBM/GPS/Lot Kadaster download bermula, frontend membuat GET quota-free ke `/health`.
- Customer kekal pada `azobss.com` semasa backend bangun.
- Jika backend tidak ready selepas 350 ms, overlay spinner dipaparkan: `Sedang menyediakan muat turun...`.
- Spinner kekal sehingga `/health` pulangkan JSON `{ ok:true }`.
- Selepas server ready, UI memaparkan `Server sedia / Memulakan muat turun...` dan barulah request download sebenar dicetuskan.
- Health check tidak menggunakan kuota 5 kali dan tidak mengubah purchase record.
- Timeout maksimum kira-kira 95 saat. Jika server masih gagal tersedia, download tidak dicetuskan dan kuota tidak digunakan.
- PA native attachment flow v1136 dikekalkan, tetapi navigation ke Render hanya berlaku selepas backend disahkan ready.
- Existing exact-once counter, Reset 0/5, Test Download dan Purchase Records owner v1139 dikekalkan.

Deploy:
- Frontend sahaja untuk patch v1140.
- Backend tidak berubah kerana endpoint `/health` sudah sedia ada.
- Push/deploy frontend dan buat hard refresh `Ctrl + Shift + R`.
