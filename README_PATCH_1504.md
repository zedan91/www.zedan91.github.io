# AZOBSS v1504 — Windows-native Hardware Image Finalizer

Pembaikan khusus untuk G2 Hardware Shop. G1 PC Builds v1502 dikekalkan.

## Punca v1503
ZIP PREPARER memang membawa `local-hardware-map-v1503.js` sebagai `ready:false / downloaded:0`. Jika ZIP PREPARER ter-upload atau Node downloader tidak berjaya menghasilkan ZIP FINAL, semua gambar G2 akan menjadi placeholder.

## v1504
- Tidak memerlukan Node.js untuk menyediakan 14 gambar hardware.
- `PREPARE-LOCAL-PC-IMAGES.bat` memanggil PowerShell Windows secara terus.
- Reuse gambar lama jika fail sah sudah ada.
- Cuba `Invoke-WebRequest`, kemudian `curl.exe` sebagai fallback.
- Setiap fail diperiksa signature JPEG/PNG/WEBP/GIF; HTML/error page ditolak.
- `local-hardware-map-v1504.js` hanya menerima path yang failnya benar-benar wujud.
- ZIP FINAL tetap boleh dibina jika sebahagian berjaya; hanya item yang gagal kekal placeholder.
- Jika 0/14 berjaya, ZIP FINAL tidak dibina.

## Cara guna
1. Merge patch ke folder v1503/v1502 semasa dan pilih Replace/Overwrite.
2. Jalankan `PREPARE-LOCAL-PC-IMAGES.bat`.
3. Pastikan output menunjukkan `Hardware images ready: X/14` (sasaran 14/14).
4. Upload `(1504)-AZOBSS-FULL-WEBSITE-HARDWARE-EXACT-LOCAL-FINAL_20261103.zip`.
5. Jangan upload ZIP PREPARER.
