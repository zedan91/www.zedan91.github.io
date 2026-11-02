AZOBSS v1498 — LOCAL PC BUILD IMAGES

Tujuan
- Menyimpan semua 64 gambar produk exact yang masih menggunakan URL retailer/CDN ke dalam folder website sendiri.
- Selepas berjaya, PC Build menggunakan /PC-Build/images/products/... dan tidak hotlink gambar retailer untuk produk yang dipetakan.

Cara
1. Extract ZIP ini.
2. Double-click PREPARE-LOCAL-PC-IMAGES.bat.
3. Skrip download 64/64 gambar asal, validate format, patch JSON kepada local path, enable local resolver, kemudian bina ZIP deployment v1498.
4. Upload ZIP deployment yang dihasilkan.

Keselamatan
- ZIP deployment TIDAK akan dibina jika ada walau satu gambar gagal download/validate.
- Gambar yang berjaya disimpan supaya retry tidak perlu download semula.
- Link “Lihat produk asal” kekal untuk rujukan produk/harga; hanya imej dipindahkan ke local website.
