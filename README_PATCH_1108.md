# AZOBSS v1108 — PA/GPS/Lot Kadaster Earth + GPS Map Search

Baseline: v1107.

Perubahan v1108:
- Peta Pilihan PA kini mempunyai butang `Earth` + `MyLot ↗`, sama seperti BM/SBM. Earth menukar basemap kepada Esri World Imagery sambil mengekalkan NDCDB dan menambah C3.
- Peta Pilihan Lot Kadaster Berdigit dan Lot Kadaster Berdigit C3 kini mempunyai butang `Earth` + `MyLot ↗`. Earth mengekalkan layer produk semasa dan menambah layer kadaster pelengkap NDCDB/C3 di atas imej satelit.
- GPS kini mempunyai bahagian `ATAU CARI DI PETA` dengan carian `Nombor Lot / Nombor PA / WGS84` serta butang `Buka Peta Pilihan GPS`.
- Peta GPS memaparkan sehingga 30 stesen GPS terdekat, nombor stesen pada pin, highlight pilihan, garisan putus-putus dari rujukan ke GPS dan label jarak.
- Carian GPS melalui Nombor Lot/PA menggunakan resolver kadaster JUPEM yang sama seperti BM/SBM; jika nombor lot berulang, pengguna mesti memilih lot yang betul.
- Peta GPS turut mempunyai Earth + NDCDB/C3 + MyLot dan single-click info lot dalam Earth mode. Double-click sahaja mengubah titik carian GPS.
- Detail GPS menyediakan WGS84 + ikon Google Maps dan butang Tambah GPS ke Troli.
- Backend baharu `GET /api/pabm-gps-nearby` mencari GPS terdekat menggunakan indeks WGS84 stesen GPS tempatan yang sah.
- Cache-buster `azobss-pabm-map-search.js` dan `azobss-lot-selection-map.js` dinaikkan ke v1108.

Deploy:
- Frontend perlu push/deploy seperti biasa.
- Render backend WAJIB redeploy kerana v1108 menambah endpoint `/api/pabm-gps-nearby`.
