# AZOBSS v1117 — PA Auto-Detect Negeri + PA2131 Map Resolver Fix

Baseline: `(1116)-AZOBSS-PA-MAP-FULL-LOT-RENDER-TILE-RECOVERY-FIX_20260915.zip`

## Masalah
Selepas v1115/v1116, carian peta `PAxxxx` masih boleh memaparkan `Tiada PA/lot ditemui` atau `Nombor PA tersebut tidak ditemui pada peta JUPEM untuk negeri yang dipilih` apabila negeri yang sedang dipilih pada halaman tidak sama dengan negeri sebenar PA. Contoh semasa ujian: pengguna berada pada Johor dan mencari `PA2131`.

Selain itu, parser PA backend terlalu ketat terhadap paparan nombor PA JUPEM. Jika JUPEM memaparkan ruang/pemisah pada nombor PA, rekod sah boleh terbuang sebelum resolver geometri dijalankan.

## Pembetulan
- Carian peta PA kekal mewajibkan awalan `PA`: `PA2131` / `pa2131` diterima; `2131` kekal dianggap Nombor Lot.
- Parser keputusan Pelan Akui JUPEM kini menormalkan format paparan PA sebelum validasi (`PA 2131` -> `PA2131`).
- Resolver PA mula-mula cuba negeri yang sedang dipilih. Jika tiada padanan, ia mencari PA rasmi JUPEM pada negeri lain dalam batch kecil dan auto-detect negeri sebenar.
- Geometri lot hanya diselesaikan selepas negeri PA ditemui supaya carian silang-negeri tidak membebankan ArcGIS JUPEM secara berlebihan.
- Peta Pilihan PA menukar overlay kadaster kepada negeri sebenar PA secara automatik dan memaklumkan jika PA berada di negeri lain daripada pilihan semasa.
- Peta BM/SBM/GPS menggunakan negeri sebenar PA untuk mencari stesen terdekat, bukan negeri lama yang masih dipilih pada borang.
- Overlay kadaster BM/SBM/GPS dan Earth/C3 turut bertukar kepada negeri PA yang dikesan.
- Jika JUPEM memulangkan PA yang sama pada beberapa negeri dalam batch yang sama, sistem tidak meneka; pengguna diminta memilih negeri yang betul.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke `v1117`.

## Deploy
Perubahan melibatkan frontend dan `deploy-server.js`:
1. Push/deploy GitHub Pages.
2. Redeploy backend Render AZOBSS.
3. Selepas deploy, buat `Ctrl + F5`.

## Semakan
- `node --check assets/js/azobss-pabm-map-search.js`
- `node --check deploy-server.js`
- `npm run check`
