# AZOBSS v1147 — Keep PA/BM Page During Download

Baseline: v1146.

## Punca sebenar
PA normal download masih menggunakan `window.location.assign(nativeUrl)`. Oleh sebab `nativeUrl` ialah `azobss-backend.onrender.com/api/pa-bm-download`, tab semasa memang diarahkan ke Render. Jika service sedang cold-start, pengguna nampak halaman `SERVICE WAKING UP`.

## Fix
- PA normal attachment tidak lagi menggunakan `window.location.assign`.
- Download attachment dicetus melalui iframe 1x1 tersembunyi.
- Kalau Render tiba-tiba cold-start, halaman Render hanya boleh termuat dalam iframe tersembunyi, bukan menggantikan `/PA-BM/`.
- Lot Kadaster ZIP backend attachment menggunakan kaedah sama.
- Backend fallback yang menunjuk ke `azobss-backend.onrender.com` juga tidak menavigasi top-level page.
- Health wait `/health`, auto-wake on page entry, spinner button, exact-once quota, Reset 0/5 dan Test POV kekal.

Frontend sahaja. Backend tidak berubah. Hard refresh selepas deploy.
