# AZOBSS Patch v988 — Render Dockerfile Path / Deploy Fix

Punca deploy gagal pada Render:
`failed to read dockerfile: open Dockerfile: no such file or directory`

Perubahan v988:
- ZIP kini FLAT: fail repo seperti `Dockerfile`, `render.yaml`, `package.json` berada terus di root ZIP, bukan di dalam folder `v987_work/`.
- `Dockerfile` root masih dikekalkan.
- Ditambah `render-backend.dockerfile` sebagai salinan Dockerfile yang eksplisit.
- `render.yaml` kini menggunakan:
  `dockerfilePath: ./render-backend.dockerfile`
- `buildFilter.paths` turut memasukkan `render-backend.dockerfile`.
- Runtime AZOBSSTV/EPG v987 dikekalkan, hanya nombor package/cache dinaikkan ke v988.
- Tiada perubahan kepada logic Public EPG API, player, Favorites/Recent, PA/BM, JUPEM, payment atau CAD converter.

Selepas upload ke GitHub:
1. Pastikan di ROOT repo kelihatan `render-backend.dockerfile`, `Dockerfile`, `render.yaml`, `package.json`, dan `deploy-server.js`.
2. Render > service `azobss-backend` > Settings:
   - Root Directory: kosong / repo root
   - Dockerfile Path: `./render-backend.dockerfile`
3. Manual Deploy > Clear build cache & deploy (sekali selepas perubahan path ini).
