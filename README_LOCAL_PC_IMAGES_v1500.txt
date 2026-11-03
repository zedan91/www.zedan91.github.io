AZOBSS v1500 — LOCAL IMAGE RUNTIME HARDENING

Punca v1498:
1. PC Builds menggunakan local-image map, tetapi Hardware Shop masih terus menggunakan URL imej daripada live API.
2. Sync live boleh membawa URL/ID imej yang tidak sama dengan manifest, lalu browser kembali cuba hotlink.
3. Retry lama menukar gambar gagal kepada teks “Gambar produk sedang dimuat semula” walaupun tiada upload sebenar sedang berlaku.
4. Produk yang memang tiada gambar disahkan boleh memaparkan broken-image/alt text sementara.

v1500:
- Satu resolver lokal digunakan oleh PC Builds dan Hardware Shop.
- Padanan dibuat melalui ID, URL imej dan nama produk exact yang telah dimanifestkan.
- Selepas PREPARE selesai, enforceLocal=true: URL imej luar tidak digunakan lagi untuk katalog PC/Hardware.
- Jika tiada gambar lokal exact, paparan stabil “Gambar produk belum tersedia”.
- Tiada lagi state palsu “sedang dimuat semula”.
- Download 64 gambar exact v1498 dikekalkan dan divalidasi sebelum ZIP deploy dibina.
