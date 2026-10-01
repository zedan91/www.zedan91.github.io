# AZOBSS v1116 — PA Map Full Lot Render + JUPEM Tile Recovery Fix

Baseline: `(1115)-AZOBSS-PA-PREFIX-BM-SBM-GPS-PA-RESOLVER-FIX_20260915.zip`

## Masalah
Dalam Peta Pilihan PA, lot yang ditemui melalui klik/WGS84 kadang-kadang nampak hanya sebahagian, lambat lengkap, atau hanya kelihatan betul selepas pengguna zoom out. Lapisan kadaster JUPEM juga boleh meninggalkan tile kosong apabila satu permintaan tile gagal sementara.

## Punca
1. Carian WGS84 v1112 mengekalkan zoom semasa secara ketat. Jika lot lebih besar daripada ruang peta semasa atau modal Leaflet belum selesai mengukur saiz, sebahagian polygon boleh berada di luar viewport/terpotong sehingga zoom berubah.
2. Overlay kadaster meminta `scope=all`, menyebabkan setiap tile meminta banyak layer negeri JUPEM walaupun pengguna hanya melihat satu negeri. Ini menambah masa render dan meningkatkan risiko tile timeout/gagal.
3. Leaflet tidak retry tile JUPEM yang gagal secara automatik, jadi tile kosong boleh kekal sehingga zoom/pan menghasilkan permintaan tile baharu.

## Pembetulan
- Peta PA masih mengekalkan zoom pengguna sebagai had maksimum, tetapi akan auto zoom-out sedikit hanya apabila perlu supaya keseluruhan lot terpilih muat dalam paparan.
- `invalidateSize()` diulang selepas modal dibuka (60/180/520 ms) supaya saiz akhir Leaflet stabil sebelum polygon dikunci.
- Polygon lot terpilih di-fit semula selepas 140/420 ms untuk mengatasi race layout awal tanpa lookup network kedua.
- Overlay kadaster PA/BM/SBM/GPS kini meminta layer negeri aktif sahaja, bukan semua negeri serentak.
- Jika WGS84 PA auto-detect negeri lain, overlay NDCDB/C3 ditukar ke negeri sebenar secara automatik.
- Tile JUPEM yang gagal sementara akan retry secara berperingkat sehingga 4 kali tanpa pengguna perlu zoom out.
- `updateWhenZooming` dimatikan dan `keepBuffer=3` digunakan untuk mengurangkan burst permintaan tile semasa zoom.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke `v1116`.

## Deploy
Perubahan frontend sahaja:
1. Push/deploy GitHub Pages.
2. Render backend tidak perlu redeploy untuk patch ini.
3. Hard refresh browser selepas deploy (Ctrl+F5).

## Semakan
- `node --check assets/js/azobss-pabm-map-search.js`
- `npm run check`
