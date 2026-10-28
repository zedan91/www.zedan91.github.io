# AZOBSS Patch 1202 — Lot Kadaster DXF Safe Syit Fallback

Package version: `1.0.1202`
Baseline: `1.0.1201`
Date: 3 October 2026

## Punca

Rekod Lot Kadaster yang sah boleh gagal dimuat turun sebagai DXF/DWG dengan mesej:

`Sistem koordinat Lot Kadaster tidak sepadan dengan grid negeri yang dijangka.`

Mesej itu datang daripada validasi layer tambahan **Syit Piawai**. Geometri utama NDCDB dalam ZIP/SHP boleh sah, tetapi keseluruhan conversion sebelum ini dibatalkan apabila CRS Syit Piawai tidak dapat dipadankan dengan cukup yakin.

## Fix v1202

- ZIP/SHP NDCDB kekal sebagai ground truth untuk geometri lot.
- Syit Piawai kini **best-effort enhancement**.
- Jika CRS/auth/geometri Syit Piawai tidak dapat disahkan, backend skip **SYIT_PIAWAI + SYIT_LABEL sahaja**.
- DXF/DWG tetap dijana dengan `PER NDCDB`, `NOLOT` dan `NOPA`.
- Guard keselamatan dalam converter kekal: Syit yang memang tersedia tetapi tidak overlap dengan lot tidak akan digabungkan.
- Converter cache dinaikkan ke `1202.1` supaya fail lama tidak bercampur dengan output fallback baru.
- ZIP asal tidak berubah.
- Kuota download tidak sepatutnya digunakan jika conversion benar-benar gagal.

Backend Render perlu redeploy.
