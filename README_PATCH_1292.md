# AZOBSS v1292 — Homepage Services Move Up + Banner Auto-Save Verification

## Fixes

1. **Our Services benar-benar dinaikkan**
   - Desktop `#Software.services-section` menggunakan `margin-top: -48px` dan `padding-top: 18px`.
   - Kedudukan section ini tidak lagi bergantung pada resize / drag banner.

2. **Drag / resize banner terus auto-save**
   - Bila pointer/mouse dilepaskan selepas drag atau resize, X/Y/Width/Height terus ditulis ke Firestore `homeBanners`.
   - Selepas write, data dibaca semula dengan `getDoc()` dan geometry disahkan.
   - Status `DISIMPAN` hanya ditunjukkan selepas pengesahan Firestore berjaya.

3. **Lindung daripada race semasa page load**
   - Jika admin sudah mula drag/resize sebelum bacaan Firestore awal selesai, data cloud lama tidak akan overwrite banner yang sedang diedit.

4. **Manual Simpan kekal**
   - Butang `Simpan` masih digunakan untuk gambar/link/show-hide/new-tab dan semua setting lain.
   - Geometry input X/Y/Width/Height juga auto-save bila input selesai diubah.

## Firebase

Masih menggunakan collection `homeBanners` dan rules v1288 yang sama.
