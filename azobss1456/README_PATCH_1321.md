# AZOBSS v1321 — Tech Vault SolatTime Download Shortcut

## Perubahan
- Menambah kad **AZOBSS SolatTime** di `/tech/` selepas Tech Vault dibuka.
- Kad mencari fail terbaru dalam Tech Vault yang nama failnya mengandungi `AZOBSS SolatTime` atau `SolatTime`.
- Butang **Download** menggunakan endpoint secure download-token sedia ada, jadi fail R2 kekal private dan link sebenar tidak di-hardcode.
- Jika terdapat beberapa build SolatTime, shortcut memilih fail paling baru berdasarkan `createdAtMs/createdAt`.
- Jika fail belum wujud, kad memaparkan `Belum tersedia` serta arahan nama fail yang perlu digunakan semasa upload.
- Badge laman dan cache-buster global dinaikkan ke v1321.

## Cara guna
1. Buka `/tech/` dan unlock Tech Vault.
2. Upload fail SolatTime jika belum ada. Pastikan nama fail mengandungi `AZOBSS SolatTime` atau `SolatTime`, contoh `AZOBSS-SolatTime-v1.0.exe`.
3. Kad Featured Software akan mengesan build terbaru secara automatik.
4. Tekan **Download** untuk mendapatkan fail melalui secure R2 token.
