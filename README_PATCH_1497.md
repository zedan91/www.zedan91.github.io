# AZOBSS v1497 — PC Build image cache + Render memory hardening

Baseline: v1496.

## Fix utama
- Endpoint `/api/pc-shop/image/:id` dan `/api/pc-shop/build-image/:id` tidak lagi memulakan full live catalog sync hanya untuk memaparkan gambar.
- Live hardware/build refresh menggunakan single-flight supaya request serentak tidak menggandakan kerja scrape yang sama.
- Live verification dihadkan kepada concurrency kecil (`PC_SHOP_LIVE_CONCURRENCY`, default 3).
- Cache HTML/source dibatasi; payload besar dibenarkan dibersihkan GC.
- Cache buffer gambar dan hasil Sharp dibatasi mengikut jumlah byte/entry; Sharp cache/concurrency direndahkan untuk Render.
- Pipeline gambar dihadkan kepada 2 kerja serentak dan fetch/clean untuk URL sama didedupe.
- Forced retailer refresh selepas setiap Render restart dimatikan secara default. Admin refresh masih tersedia. Jika benar-benar perlu, set `PC_RETAILER_BOOT_REFRESH=1`.
- API menghantar `imageFallback` (gambar direct yang sudah diketahui) supaya browser boleh fallback tanpa mengulang beban proxy.
- Frontend cuba direct fallback dahulu jika proxy gagal; placeholder lama `Gambar exact daripada sumber belum tersedia` tidak lagi muncul selepas satu kegagalan sementara.

## Tujuan
Kurangkan lonjakan RAM, elakkan restart Render berulang, dan jadikan gambar produk lebih stabil terutama apabila banyak kad dimuat serentak.
