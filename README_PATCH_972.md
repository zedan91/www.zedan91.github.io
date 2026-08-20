# AZOBSS Patch 972 — AZOBSSTV Official Player Auto-Fit

## Perubahan
- Official Mana-Mana iframe kini menggunakan virtual viewport 1280×720 dan di-scale secara automatik supaya keseluruhan frame muat dalam ruang player AZOBSSTV.
- ResizeObserver memastikan frame kekal fit apabila saiz browser berubah.
- Toolbar AZOBSSTV official-player kini overlay dan tidak lagi mengambil tinggi daripada iframe.
- Best-effort cookie accept ditambah **hanya apabila iframe same-origin**. Untuk `mana2.my` yang cross-origin, browser Same-Origin Policy menghalang `azobss.com` daripada mengklik butang Accept di dalam iframe.
- Tiada proxy/rewrite halaman Mana-Mana atau pemintasan token/cookie diperkenalkan.
- Cache/service-worker/app version dinaikkan ke 972.

## Tidak berubah
- 25 channel Mana-Mana.
- RTM official-player fallback.
- PA/BM, JUPEM, payment, CAD converter, Repair PC, auth, More menu.
