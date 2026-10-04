# AZOBSS Patch v993 — AZOBSSTV Anime Full Title Wrap Fix

Punca:
- v991/v992 menggunakan `-webkit-line-clamp: 2` pada tajuk kad Anime.
- Tajuk panjang dipotong selepas dua baris dan browser memaparkan `...`.

Fix:
- 2-line clamp dibuang untuk tajuk Anime sahaja.
- Ellipsis dibuang.
- Tajuk boleh wrap ke sebanyak baris yang diperlukan.
- Tinggi kad Anime berkembang ikut tajuk penuh.
- Tahun/genre masih dikekalkan kompak.
- Live TV dan komponen lain tidak berubah.
