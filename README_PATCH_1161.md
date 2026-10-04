# AZOBSS Patch 1161 — Lot Kadaster Syit Piawai DXF Layers

Package version: `1.0.1161`
Baseline: `1.0.1160`
Date: 26 September 2026

## Perubahan

- DXF Lot Kadaster kini boleh memasukkan garisan Syit Piawai berkaitan pada layer `SYIT_PIAWAI`.
- Nombor/nama syit dimasukkan pada layer `SYIT_LABEL`.
- Garisan syit menggunakan keseluruhan sempadan syit yang berkaitan, bukan dipotong setakat AOI.
- Paparan awal AutoCAD kekal fokus pada lot yang dibeli; `ZOOM Extents` menunjukkan keseluruhan syit.
- Layer sedia ada `PER NDCDB`, `NOLOT` dan `NOPA` dikekalkan.
- Backend mendapatkan syit daripada exact selected lot IDs yang disimpan dalam signed selection token.
- Overlay syit mempunyai coordinate-overlap guard supaya grid tersasar tidak diberikan kepada pengguna.
- Pembelian lama yang tiada selectedObjectIds masih boleh menghasilkan CAD lot biasa tanpa overlay syit.
- CAD converter dinaikkan daripada `944.1` kepada `1161.1` untuk invalidasi cache CAD lama.

## Full package

Ini ialah FULL WEBSITE package, bukan patch-only package.
Ia dibina di atas kandungan website v1158 dan dipulihkan secara tepat kepada perubahan GitHub v1159 + v1160 sebelum v1161 digunakan.

## Validation

- `npm run check` passed.
- Public DXF synthetic smoke test passed untuk `SYIT_PIAWAI`, `SYIT_LABEL`, label syit dan layer lot sedia ada.
- Internal LibreDWG R2000 DXF profile smoke test turut mengandungi layer Syit Piawai.
- ZIP mengandungi root website terus, tanpa wrapper folder tambahan, supaya serasi dengan AutoLatestZipBot.
