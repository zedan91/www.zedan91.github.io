# AZOBSS v1135 — BM/SBM Selected Station Label Colour Fix

## Perubahan

- Peta Pilihan BM/SBM: label nombor stesen yang belum dipilih kini dipaparkan dengan latar putih dan teks gelap supaya lebih mudah dibaca di atas peta.
- Apabila BM/SBM dipilih, label stesen tidak lagi menjadi hitam/gelap. Label pilihan kini menggunakan biru terang (`#2563eb`) dengan teks putih, border biru muda dan shadow lembut.
- Warna ini sepadan dengan highlight pilihan di panel kanan dan membezakan stesen aktif daripada stesen lain tanpa menutup nombor lot di peta.
- Tiada perubahan pada carian BM/SBM, jarak, koordinat, pilihan lot/PA, troli, harga atau backend.

## Deploy

Perubahan ini static frontend sahaja. Push/deploy GitHub Pages. Render backend tidak perlu redeploy.
