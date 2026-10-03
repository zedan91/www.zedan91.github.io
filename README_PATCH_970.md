# AZOBSS Patch 970 — AZOBSSTV RTM Direct-First + Relay Fallback Fix

## Punca yang disahkan daripada v969
HTTP 502 kini berlaku selepas query parser sudah betul. Ini bermaksud permintaan sampai ke handler relay, tetapi laluan server-side ke upstream RTM masih gagal/ditolak.

## Fix
- Lima channel RTM bawaan kini menggunakan `x-mode="auto"`.
- Chromium/Hls.js cuba stream HLS **terus dari browser dahulu**.
- Jika direct gagal kerana CORS/network, AZOBSSTV automatik cuba **backend relay** tanpa pengguna perlu klik semula.
- Jika kedua-duanya gagal, UI menyatakan direct + relay telah dicuba.
- Relay RTM kini menghantar `Referer`, `Origin`, `Accept-Language` dan User-Agent Chrome biasa.
- Upstream HTTP 4xx tidak lagi disamarkan sebagai 502; status sebenar seperti 403/429 boleh dilihat di player.
- Timeout direct 12 saat akan trigger relay fallback jika browser stall tanpa fatal event.
- Health endpoint melaporkan `playback_strategy: direct-first-relay-fallback`.
- Cache/service worker/app version dinaikkan ke 970.

## Tidak disentuh
PA/BM, JUPEM, payment, CAD converter, Repair PC, auth, More menu dan katalog 25 channel Mana-Mana.
