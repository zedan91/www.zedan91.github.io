# AZOBSS v1501 — Local Image Lock Architecture

## Tujuan
Mengembalikan kestabilan gambar seperti PC Build asal: gambar customer-facing adalah aset lokal website dan tidak berubah apabila live sync retailer berjalan.

## Polisi v1501
- Live sync: harga, stok, identiti produk, spesifikasi dan tarikh semakan sahaja.
- Gambar: hanya `/PC-Build/images/products/...` selepas preparer selesai.
- Public API tidak lagi menghantar URL image proxy/hotlink sebagai gambar kad. Endpoint imej lama dikekalkan untuk kompatibiliti/admin tetapi tidak digunakan oleh storefront.
- Jika tiada padanan lokal: placeholder stabil `Gambar produk belum tersedia`.
- Remote CDN gagal / URL berubah tidak boleh menukar atau menghilangkan gambar lokal yang sudah dikunci.
- Exact override dibekalkan untuk DeepCool CC310 dan Cooler Master QUBE 540 yang sebelum ini tersalah banner ALL IT.

## Upgrade
1. Extract merge patch v1501 di atas folder self-contained v1500 dan Replace/Overwrite.
2. Jangan padam `PC-Build/images/products/`.
3. Jalankan `PREPARE-LOCAL-PC-IMAGES.bat`. Ia menggabungkan manifest v1500 lama, menggunakan semula imej valid sedia ada, dan hanya menambah/baiki gambar yang perlu.
4. Deploy ZIP `(1501)-AZOBSS-FULL-WEBSITE-LOCAL-IMAGE-LOCKED_20261103.zip` yang dihasilkan.
5. Redeploy Render kerana `lib/azobss-pc-shop-runtime.js` berubah.
