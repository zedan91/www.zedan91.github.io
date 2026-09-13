# AZOBSS Patch 1098 — BM/SBM Search by Lot / PA / WGS84

Tarikh: 13 September 2026  
Package version: 1.0.1098

## Tujuan
Naik taraf Peta Pilihan BM dan SBM supaya lokasi rujukan boleh dicari menggunakan Nombor Lot, Nombor PA atau koordinat WGS84.

## Perubahan
- Input BM/SBM `Carian WGS84` ditukar kepada `Nombor Lot / Nombor PA / WGS84`.
- Contoh input: `Lot 1122`, `PA2131`, atau `3.1390, 101.6869`.
- Nombor biasa tanpa awalan dianggap sebagai Nombor Lot. Carian Pelan Akui perlu menggunakan awalan `PA` untuk mengelakkan salah tafsir.
- Backend `/api/pabm-benchmark-nearby` kini boleh menerima carian rujukan Lot/PA selain lat/lng.
- Carian Lot menggunakan rekod dan geometri kadaster JUPEM untuk mendapatkan pusat lot, kemudian mencari BM/SBM terdekat daripada lokasi tersebut.
- Jika nombor lot yang sama mempunyai beberapa padanan dalam negeri, sistem tidak memilih secara tekaan. Semua lot dipaparkan pada peta dan pengguna perlu memilih lot yang betul dahulu.
- Carian PA memadankan geometri PA JUPEM, termasuk PA yang meliputi lebih daripada satu lot, kemudian mencari BM/SBM terdekat daripada pusat kawasan PA.
- Kawasan Lot/PA rujukan dipaparkan pada peta dan nombor rujukan digunakan pada label/jarak.
- Klik lokasi kosong pada peta masih menjalankan carian WGS84 seperti sebelum ini.
- Fungsi pin BM/SBM bernombor dan highlight pilihan daripada v1096 dikekalkan.
- SEO/noindex Google daripada v1097 dikekalkan.

## Deploy
Perubahan melibatkan `deploy-server.js`, jadi:
1. Push frontend/GitHub Pages seperti biasa.
2. Redeploy backend Render AZOBSS supaya carian Lot/PA BM/SBM aktif.

## Semakan
- `node --check assets/js/azobss-pabm-map-search.js`
- `npm run check`
