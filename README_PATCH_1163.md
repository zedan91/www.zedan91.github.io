# AZOBSS Patch 1163 — Syit Piawai CAD CRS Auto-Match Fix

Package version: `1.0.1163`
Baseline: `1.0.1162`
Date: 26 September 2026

## Punca v1162

Popup:
`Garisan Syit Piawai tidak sepadan dengan sistem koordinat Lot Kadaster`

berlaku kerana lot dalam SHP/DXF menggunakan grid kadaster negeri (metre), tetapi
query Syit Piawai v1162 tidak menetapkan `outSR`. ArcGIS boleh memulangkan geometri
syit dalam sistem koordinat servis/WGS84, lalu converter membandingkan nilai darjah
dengan koordinat grid negeri dan menolaknya.

## Fix v1163

- Backend membaca bbox sebenar daripada SHP yang sudah dimuat turun.
- Untuk negeri berkenaan, backend mencuba grid GDM2000 dan grid legacy yang relevan.
- Exact selected lot IDs diproyeksikan oleh ArcGIS ke candidate CRS.
- CRS yang bbox-nya paling hampir dengan SHP dipilih secara automatik.
- Query Syit Piawai kemudian menggunakan `outSR` yang sama.
- Tidak meneka/translate garisan secara manual; jika kedua-dua CRS tidak sepadan,
  sistem tetap berhenti untuk mengelakkan garisan tersasar.
- Selangor/KL/Putrajaya: auto-match antara EPSG:3380 dan EPSG:4393.
- CAD cache dinaikkan ke `1163.1`, jadi cache v1162 tidak digunakan semula.
- Fix LAYER table v1162 (`390 PlotStyleName` + `347 Material`) kekal.
- Full website ZIP, bukan patch-only.
