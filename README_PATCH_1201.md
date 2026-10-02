# AZOBSS v1201 — Lot Kadaster Tile Auth Auto-Recovery

Baseline: v1200

## Masalah
Peta asas pada `Peta Pilihan Lot Kadaster` boleh masih kelihatan tetapi garisan/polygon lot kadaster hilang sepenuhnya.

## Punca
Endpoint `/api/jupem-lot-map/tile/...png` menggunakan token/session ArcGIS yang dicache. Jika token/session sumber peta tamat atau ditolak sebelum waktu cache dalaman habis, endpoint tile lama terus menggunakan auth yang sama dan memulangkan 502 untuk setiap tile. Leaflet hanya retry URL tile, jadi semua retry masih terkena token lama.

## Fix v1201
- Backend tile kini cuba auth biasa dahulu.
- Jika respons export bukan imej / gagal, cache token dibuang dan token + session baharu diminta sekali secara paksa.
- Tile yang berjaya selepas recovery dihantar seperti biasa.
- Frontend masih retry setiap tile sehingga 4 kali. Jika beberapa tile tetap gagal selepas semua retry, satu full-layer recovery berjarak masa dijalankan dengan cache key baharu supaya viewport meminta semula tile.
- Full-layer recovery mempunyai cooldown untuk mengelakkan request storm.
- Cache-buster `azobss-lot-selection-map.js` dinaikkan ke `v=1201`.

## Deploy
Frontend + Render backend perlu redeploy kerana pembetulan utama berada dalam `deploy-server.js`.

## Unchanged
Harga, cart, payment, pemilihan lot, strict intersection, natural boundary, PA/BM/GPS, commission dan payout tidak diubah.
