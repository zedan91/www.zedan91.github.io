# AZOBSS Patch 1151 — PA/BM Download Backend Wake Retry Fix

Tarikh: 18 September 2026

## Isu
Pelanggan yang sudah membuat pembayaran boleh mendapat popup:
`Server mengambil masa terlalu lama untuk tersedia. Sila cuba semula sebentar lagi. Kuota muat turun tidak digunakan.`

Rekod pembayaran sebenarnya sudah wujud dan kuota masih `0/5`, tetapi frontend v1150 hanya menunggu backend Render selama **70 saat**. Render Free boleh mengambil kira-kira seminit untuk bangun dan kadang-kadang lebih lama ketika cold-start/restart, jadi v1150 boleh berhenti terlalu awal walaupun backend sedang bangun.

## Perubahan v1151
- Kekalkan flow v1150 `fetch -> Blob -> browser download` dan spinner sehingga fail sebenar diterima.
- Tempoh menunggu `/health` backend dinaikkan daripada **70 saat** kepada **4 minit**.
- Setiap cubaan health boleh menunggu sehingga **30 saat** sebelum dicuba semula.
- Tiada popup timeout selepas 70 saat; sistem terus retry secara automatik selagi backend masih dalam tempoh bangun.
- Had download **5 kali**, tempoh **7 hari**, `downloadAttemptId`/idempotency, harga dan rekod pembelian tidak diubah.
- Kegagalan sebelum fail tersedia masih tidak menggunakan kuota download.
- Cache-buster `/PA-BM/` dinaikkan ke `v=1151`.
- Package version: `1.0.1151`.

## Deploy
Patch ini ialah perubahan frontend. Deploy kandungan website/GitHub Pages seperti biasa. Render backend tidak perlu redeploy untuk perubahan timeout ini.
