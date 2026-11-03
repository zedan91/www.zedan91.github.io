# AZOBSS v1505 — Hardware Exact Images Auto-Vendored by GitHub

## Tujuan
G1 PC Builds kekal seperti v1502/v1504. G2 Hardware Shop menggunakan 14 gambar produk exact yang disimpan sebagai fail lokal dalam repository.

## Apa yang berubah
- Tiada BAT diperlukan.
- Selepas package di-push ke GitHub, workflow `.github/workflows/vendor-hardware-images-v1505.yml` berjalan automatik.
- Workflow mengambil gambar exact daripada endpoint produk / URL yang telah disahkan, memeriksa signature fail dan saiz minimum, kemudian menyimpan fail ke `PC-Build/images/products/`.
- Hanya apabila 14/14 berjaya, `local-hardware-map-v1505.js` ditulis sebagai `ready:true` dan semua fail di-commit ke repository.
- Jika kurang daripada 14 berjaya, workflow gagal dan map kekal `ready:false`; ia tidak menerbitkan gambar separa sebagai siap.
- Customer-facing page tidak hotlink retailer. Selepas workflow berjaya, semua 14 gambar datang dari `www.azobss.com/PC-Build/images/products/...`.

## Selepas upload
1. Push kandungan package ini ke repository AZOBSS.
2. GitHub > Actions > `AZOBSS v1505 - Vendor exact hardware images`. Pastikan run hijau.
3. Selepas commit bot masuk, refresh `/PC-Build/` dengan Ctrl+F5.
4. Jika repository menyekat token Actions daripada menulis, aktifkan `Settings > Actions > General > Workflow permissions > Read and write permissions`, kemudian Run workflow sekali.

## Integrity
Workflow hanya menandakan map `ready:true` selepas 14/14 fail exact lulus pengesahan JPEG/PNG/WEBP/GIF dan saiz minimum.
