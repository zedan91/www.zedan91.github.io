# AZOBSS Patch 1093 — PA / BM / SBM WGS84 Map Search

Baseline: v1092
Package version: 1.0.1093

## Perubahan
- Bahagian **Pelan Akui (PA)** ditambah satu carian peta baharu menggunakan **Nombor Lot atau WGS84**.
- Selepas negeri dipilih, carian PA membuka **Peta Pilihan PA** dan memfokuskan lot JUPEM yang ditemui.
- Pengguna boleh klik lokasi lain pada peta untuk menyemak lot/PA pada koordinat WGS84 tersebut.
- Maklumat PA, nombor lot, daerah, mukim dan seksyen dipaparkan sebelum item PA ditambah ke troli.
- Bahagian **BM** dan **SBM** ditambah carian **WGS84** yang membuka Peta Pilihan BM/SBM.
- Peta BM/SBM memaparkan stesen terdekat, jarak dari koordinat WGS84, lokasi dan butang tambah ke troli.
- Klik lokasi lain pada peta BM/SBM akan menjalankan semula carian stesen terdekat pada titik baharu.
- Backend ditambah endpoint `/api/pabm-pa-map-search` dan `/api/pabm-benchmark-nearby` untuk carian peta ini.
- BM menggunakan indeks WGS84 tempatan apabila mencukupi; SBM dan keadaan yang memerlukan data tambahan menggunakan lapisan peta JUPEM dengan fallback yang tersedia.
- Input WGS84 menerima susunan `Latitude, Longitude` dan juga `Longitude, Latitude` untuk koordinat Malaysia.

## Skop
- Perubahan hanya melibatkan aliran PA, BM dan SBM yang diminta.
- GPS, Syit Piawai, Lot Kadaster Berdigit, Lot Kadaster C3, pembayaran dan fungsi lain tidak diubah.
