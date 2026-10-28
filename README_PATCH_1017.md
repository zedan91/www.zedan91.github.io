# AZOBSS v1017 — Movable Reference Rectangle Fix

## Fix
- Petak yang telah siap/finalize kini boleh dialihkan dengan drag pada mana-mana kawasan berisi di dalam petak.
- Drag memindahkan seluruh petak tanpa mengubah Lebar/Panjang.
- Titik pusat, empat pemegang resize, cross guide dan label jarak bergerak bersama secara live.
- Semasa drag, pilihan lot tidak dikira berulang kali; pengiraan lot dibuat semula sekali selepas drag tamat supaya interaksi kekal ringan.
- Pemegang kiri/kanan/atas/bawah sedia ada kekal khusus untuk resize.
- Mouse, pen dan touch menggunakan Pointer Events.
- Map panning dinyahaktif sementara ketika petak sedang diseret dan dipulihkan selepas drag.
- Teks bantuan panel kanan/status dikemas kini untuk menerangkan drag-to-move.

## Tidak berubah
- Logik strict positive-area intersection dan natural boundary.
- Harga/checkout/backend JUPEM.
- Bulatan.
- Live TV, Anime dan Movies.

## Cache
- `/PA-BM/` cache-buster `azobss-lot-selection-map.js` → `v=1017`.

## Version
- Package: `1.0.1017`
