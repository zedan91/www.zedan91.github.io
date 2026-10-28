# AZOBSS v1115 — PA Prefix Map Search + BM/SBM/GPS PA Resolver Fix

Baseline: `(1114)-AZOBSS-DOWNLOAD-SUCCESS-FALSE-ERROR-POPUP-FIX_20260914_20260914_205520.zip`

## Masalah
Carian Peta Pilihan BM, SBM dan GPS boleh gagal menemui Nombor PA yang sah seperti `PA2131`. Resolver lama bergantung pada carian medan PA secara terus pada layer kadaster ArcGIS JUPEM; sesetengah PA/layer tidak memberi padanan terus walaupun PA itu wujud dalam carian Pelan Akui rasmi.

## Pembetulan
- Carian PA pada peta mewajibkan awalan `PA`: `PA2131` atau `pa2131` diterima dan dinormalkan kepada `PA2131`.
- Nombor biasa seperti `2131` kekal dianggap sebagai **Nombor Lot**, bukan PA.
- Format PA salah memaparkan mesej: `Carian PA mesti ditaip sebagai PAxxxx, contoh PA2131.`
- Backend BM/SBM/GPS mencari PA melalui carian `PelanAkui`, membuka butiran PA rasmi dan membaca senarai lot daripada jadual `exampleMini`.
- Setiap lot PA kemudian diselesaikan kepada geometri kadaster JUPEM. Jika PA meliputi beberapa lot, semua geometri digabungkan menjadi satu kawasan rujukan PA sebelum mencari BM/SBM/GPS terdekat.
- Peta Pilihan PA sendiri kini turut menerima carian terus `PAxxxx` dan memaparkan lot-lot dalam PA tersebut.
- Fallback resolver lama melalui medan PA layer kadaster dikekalkan jika butiran PA tidak tersedia sementara.
- Label input PA/BM/SBM/GPS diterangkan bahawa awalan `PA` adalah wajib untuk carian Pelan Akui.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke `v1115`.

## Deploy
Perubahan melibatkan frontend dan `deploy-server.js`:
1. Push/deploy GitHub Pages.
2. Redeploy backend Render AZOBSS.

## Semakan
- `node --check assets/js/azobss-pabm-map-search.js`
- `node --check deploy-server.js`
- `npm run check`
