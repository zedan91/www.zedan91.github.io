# AZOBSS Patch v995 — AZOBSSTV Anime Internal Detail / Episode Player

Perubahan utama:
- Klik kad Anime TIDAK lagi terus membuka AnimeNana.
- Klik Anime sekarang kekal di `/AZOBSSTV/` dan membuka:
  - poster,
  - tajuk penuh,
  - tahun/rating jika tersedia,
  - genre,
  - jumlah episod,
  - senarai episod.
- Katalog v995 mengandungi 82 siri dan 6063 public episode-page links daripada Deep Inspector.
- Senarai episod mempunyai carian dan pagination 60 episod/halaman.
- Klik episod akan cuba memaparkan halaman episod public di player AZOBSSTV.
- Backend `GET /api/azobsstv/anime/embed-check?url=...` hanya menyemak response header halaman public AnimeNana:
  - X-Frame-Options
  - CSP frame-ancestors
- Jika embed dibenarkan: halaman episod dipaparkan dalam AZOBSSTV.
- Jika provider menyekat iframe: AZOBSSTV tidak cuba bypass; player menunjukkan mesej dan butang `Buka Sumber`.
- `Buka Sumber` juga sentiasa tersedia secara manual.
- Tiada direct anime stream URL, cookie, login token, DRM key atau private credential dimasukkan.

Kekal:
- Live TV Mana-Mana + EPG,
- scroll passthrough v992,
- Anime wide cards v994,
- Favorites/Recent cloud,
- Home stickybar dan sistem AZOBSS lain.
