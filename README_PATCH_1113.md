# AZOBSS v1113 — BM/SBM Lock Selected Station While Moving WGS84

Baseline:
`(1112)-AZOBSS-PA-BM-SBM-GPS-WGS84-PRESERVE-ZOOM-FIX_20260914.zip`

Masalah:
Selepas pengguna memilih BM/SBM tertentu, apabila titik carian WGS84 diubah dengan
double-click pada peta, frontend memuat semula senarai stesen terdekat dan automatik
memilih item pertama. Ini menyebabkan BM/SBM bertukar sendiri dan garisan berubah arah.

Pembetulan:
- Klik BM/SBM pada marker atau senarai akan lock stesen tersebut.
- Double-click WGS84 baharu mengekalkan BM/SBM yang sama.
- Garisan dilukis semula dari WGS84 baharu ke BM/SBM yang terkunci.
- Jarak dikira semula.
- Jika BM/SBM terkunci tidak lagi berada dalam senarai nearest backend, ia tetap
  dikekalkan supaya pilihan pengguna tidak bertukar sendiri.
- Stesen terkunci ditanda `• Dipilih`.
- Klik BM/SBM lain memindahkan lock kepada stesen baharu.
- Tekan `Cari` untuk carian baharu atau pilih rujukan Lot/PA baharu akan reset lock.
- PA dan GPS tidak diubah.
- Cache-buster map dinaikkan ke v1113.

Deploy:
- v1113 ialah perubahan frontend sahaja.
