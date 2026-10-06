# AZOBSS Patch 1164 — Exact SHP .PRJ Syit Piawai CRS Fix

Package version: `1.0.1164`
Baseline: `1.0.1163`
Date: 26 September 2026

## Punca v1163

v1163 cuba meneka sistem koordinat DXF daripada beberapa EPSG grid negeri.
Untuk pembelian dalam screenshot, bbox SHP tidak sepadan dengan calon tersebut,
lalu backend memaparkan:

`Sistem koordinat Lot Kadaster tidak sepadan dengan grid negeri yang dijangka.`

Punca penting: fail NDCDB yang dimuat turun sendiri sudah mempunyai fail `.PRJ`
pasangan kepada `.SHP`. Jadi sistem tidak perlu meneka CRS.

## Fix v1164

- CAD converter membaca fail `.PRJ` yang sepadan dengan NDCDB `.SHP`.
- WKT daripada `.PRJ` digunakan sebagai `outSR` ArcGIS untuk geometri Syit Piawai.
- Exact selected lot IDs diproyeksikan ke WKT itu dan bbox dibandingkan dengan SHP
  sebelum Syit diterima.
- Jika `.PRJ` tiada / ArcGIS tidak menerima WKT, fallback masih tersedia.
- Fallback Peninsular kini turut memasukkan EPSG:3375
  (GDM2000 / Peninsula RSO), yang tidak dimasukkan dalam v1163.
- Converter overlap guard kekal: garisan salah koordinat tidak akan diberi kepada user.
- Fix DXF LAYER table v1162 kekal.
- CAD cache dinaikkan kepada `1164.1`.
- FULL WEBSITE package.
