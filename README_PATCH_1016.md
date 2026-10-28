# AZOBSS v1016 — Live Reference Dimension Preview Fix

## Punca
Semasa pengguna baru klik pusat Petak/Bulatan dan menggerakkan tetikus untuk menentukan saiz, `updateRadiusReference(..., false)` membuang semua `referenceGuideLayers`. Oleh itu panel kanan sudah menunjukkan Lebar/Panjang/Radius, tetapi garisan pusat-ke-sisi dan label jarak di peta hanya muncul selepas klik kedua.

## Fix
- Petak: empat garisan pusat → sisi serta label jarak kini muncul secara live semasa preview sebelum klik kedua.
- Bulatan: empat garisan radius dan label radius kini juga muncul secara live semasa preview.
- Label terus dikemas kini ketika tetikus bergerak.
- `requestAnimationFrame` digunakan untuk throttle refresh supaya tidak mencipta layer berulang kali lebih daripada sekali setiap frame.
- Selepas klik kedua/finalize, guide yang sama kekal dan resize Petak sedia ada masih mengemas kini ukuran.
- Tiada perubahan kepada logik pemilihan lot, harga, strict intersection, natural boundary, backend JUPEM, Live TV, Anime atau Movies.

## Cache
- `/PA-BM/` cache-buster `azobss-lot-selection-map.js` → `v=1016`.

## Version
- Package: `1.0.1016`
