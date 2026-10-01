# AZOBSS Patch 1159 — Homepage Software Promo FREE Quota Sync Fix

Date: 24 September 2026
Package version: `1.0.1159`
Baseline: v1158

## Punca

Homepage `SOFTWARE PROMO` menentukan label `FREE` daripada konfigurasi `promoFreeEnabled` + limit sahaja. Kad sebenar di `/Software-Tools/` pula turut menyemak jumlah unit Free Promo yang sudah dituntut. Apabila unit percuma sudah habis tetapi flag konfigurasi masih aktif, homepage kekal memaparkan `FREE` walaupun kad produk sudah kembali kepada harga promo berbayar seperti `RM30 → RM20`.

## Fixed

- Homepage kini membaca `settings/softwareStats` yang sama digunakan oleh Software Tools untuk status Free Promo.
- `FREE` hanya dipaparkan jika Free Promo benar-benar masih boleh dituntut: flag aktif, limit > 0, baki unit > 0, dan sumber muat turun percuma sah masih tersedia.
- Jika unit Free Promo sudah habis atau dimatikan, produk yang masih mempunyai diskaun berbayar akan memaparkan harga promo semasa (contoh `RM20`) dan bukan `FREE`.
- Jika Free Promo sahaja yang menjadi sebab item masuk slider dan kuotanya sudah habis, item tidak lagi dianggap promo aktif.
- `promoFreeEnabled` kekal sebagai canonical field; alias lama tidak boleh mengatasi nilai canonical.
- Logik sama dikemas kini pada modul deferred lama untuk mengelakkan regression jika loader itu digunakan semula.

## Validation

- `npm run check` passed.
- Inline homepage promo module passed `node --check` selepas diekstrak sebagai `.mjs`.
- Deferred homepage promo module passed `node --check` sebagai `.mjs`.
