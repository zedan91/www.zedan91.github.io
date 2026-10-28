# AZOBSS Patch 976 — AZOBSSTV Official Catalogue + Channel Icon Fix

## Perubahan
- TV ALHIJRAH dan TVS tidak lagi menggunakan raw HLS lama yang kini boleh membalas HTTP 404; kedua-duanya menggunakan official Mana-Mana player/auto-focus.
- Semua 25 channel bawaan Mana-Mana kini menggunakan `x-mode="official"`, jadi default catalogue tidak lagi bergantung pada raw HLS/CDN sementara yang mudah berubah.
- Semua 25 card channel mempunyai ikon. 18 channel yang sebelum ini tiada `tvg-logo` mendapat SVG badge lokal.
- Jika logo remote gagal, grid dan quick-channel rail memaparkan singkatan channel (CNA, NHK, RTM, ALH dan lain-lain) bukannya fallback generik `TV`.
- Cache/service worker, frontend query version, Device Ping app version dan backend health dinaikkan ke 976.

## Kekal
Official player auto-focus/scroll-lock, right channel rail, Service card, Favorite/Recent/search/category dan semua fungsi AZOBSS lain.
