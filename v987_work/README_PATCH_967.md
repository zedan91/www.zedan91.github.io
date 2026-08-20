# AZOBSS Patch 967 — AZOBSSTV Player Overlay / Playback Visibility Fix

## Punca
Pada v966, `#playerEmpty` mempunyai class `.player-empty { display:flex }`. Apabila JavaScript menetapkan `hidden=true`, rule author CSS tersebut boleh terus menyebabkan overlay placeholder menutup video pada browser tertentu. Ini sepadan dengan simptom: **Now Playing berubah tetapi video dan controls tidak kelihatan**.

## Fix
- Tambah `.player-empty[hidden]{display:none!important}`.
- `play()` kini memaksa placeholder `display:none` apabila channel dipilih.
- Video diberi z-index sendiri dan overlay hanya berada di atas ketika benar-benar aktif.
- Tambah panel error playback yang jelas.
- Tambah diagnostics HLS/MPEG-DASH dan event error dash.js.
- Teks placeholder kini menyebut HLS/M3U8 + MPEG-DASH.
- Cache/service worker dinaikkan ke v967.

## Tidak diubah
- Senarai 25 channel Mana-Mana v966
- PA/BM, JUPEM, payment, CAD converter, Repair PC, auth, More menu
- Tiada media stream diproxy melalui backend
