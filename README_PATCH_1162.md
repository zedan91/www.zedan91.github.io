# AZOBSS Patch 1162 — Syit Piawai DXF Open + Entity Fix

Package version: `1.0.1162`
Baseline: `1.0.1161`
Date: 26 September 2026

## Punca sebenar daripada DXF pengguna

DXF v1161 mempunyai dua masalah berasingan:

1. Layer `SYIT_PIAWAI` dan `SYIT_LABEL` dimasukkan ke LAYER table tanpa group code
   `390` (PlotStyleName). Untuk template AC1027, layer juga memerlukan `347`
   (Material handle). AutoCAD membuang keseluruhan drawing dengan mesej:
   `Error in LAYER Table / Did not receive PlotStyleName`.

2. Rekod pembelian Lot Kadaster menyimpan exact lot IDs sebagai
   `lotSelectedObjectIds`, tetapi resolver Syit v1161 hanya membaca
   `selectedObjectIds`. Akibatnya tiada LINE/TEXT entity Syit dimasukkan walaupun
   nama layer telah dicipta.

## Fix v1162

- Layer baharu mewarisi reference handle sebenar daripada template:
  - AC1027: `390` + `347`
  - internal R2000: `390`
- Resolver membaca `lotSelectedObjectIds` dan `lotObjectIdFieldName` terlebih dahulu,
  dengan fallback kepada field/token lama.
- CAD converter version dinaikkan ke `1162.1` supaya cache DXF rosak v1161 tidak digunakan.
- Layer lot asal `PER NDCDB`, `NOLOT`, `NOPA` tidak diubah.
- Full website ZIP, bukan patch-only.
