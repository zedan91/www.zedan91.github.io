# AZOBSS v1120 — PA / BM / SBM / GPS Nama Tempat Map Search

Package version: `1.0.1120`

## Perubahan

- Peta Pilihan **PA, BM, SBM dan GPS** kini boleh mencari **nama tempat** seperti `Shah Alam`, `Pasir Gudang`, `Kajang`, `Klang` dan lain-lain, sama seperti carian pada Peta Lot Kadaster Berdigit.
- Kotak carian dalam modal kini menyediakan **cadangan lokasi/autocomplete** selepas sekurang-kurangnya 3 aksara ditaip.
- Carian nama tempat menggunakan endpoint geocoder sedia ada `/api/map-location-suggestions`, jadi tiada endpoint backend baharu diperlukan.
- Negeri yang dipilih digunakan sebagai bias carian lokasi supaya hasil berhampiran negeri tersebut diutamakan.
- **Peta PA:** lokasi nama tempat digunakan sebagai titik peta. Jika lot tepat wujud pada titik itu, lot/PA dipaparkan; jika tidak, peta tetap pergi ke lokasi tersebut dan pengguna boleh klik lot berdekatan.
- **Peta BM/SBM/GPS:** lokasi nama tempat menjadi titik asal untuk mencari stesen terdekat.
- Nama tempat yang bermula dengan huruf `Pa` seperti **Pasir Gudang**, **Paka** dan **Parit Buntar** tidak lagi tersalah dianggap sebagai format PA yang rosak.
- Format sedia ada dikekalkan:
  - `PA2131` / `pa2131` = carian PA.
  - `2131` = carian Lot.
  - `Lot 1122` = carian Lot.
  - `3.1390, 101.6869` = carian WGS84.
- Label dan placeholder di halaman PA/BM dikemas kini kepada `Nombor Lot / PAxxxx / WGS84 / Nama Tempat`.
- Cache-buster `azobss-pabm-map-search.js` dinaikkan ke `v1120`.

## Deploy

Patch ini **frontend sahaja**. Backend Render tidak perlu redeploy kerana endpoint geocoder yang digunakan sudah wujud dalam baseline v1119.

Selepas push GitHub Pages, buat `Ctrl + F5` sebelum menguji.
