# AZOBSS Patch 975 — AZOBSSTV Scroll Lock + Right Channel Rail

## Perubahan
- Official Mana-Mana iframe ditetapkan `scrolling="no"` dan stage kekal `overflow:hidden` untuk mengurangkan scroll dalaman yang menyebabkan bahagian program/schedule masuk ke crop player.
- Sidebar kanan kini menggunakan ruang kosong dengan senarai channel menegak yang boleh discroll.
- Kad Service/Playlist/EPG/Channels dipindahkan ke bahagian bawah sidebar dan dijadikan lebih kompak.
- Senarai quick-channel mengikut tab/search/category semasa, boleh klik untuk play dan toggle favorite.
- Tinggi sidebar diselaraskan automatik dengan tinggi player pada desktop menggunakan ResizeObserver; pada mobile ia kembali ke flow biasa.
- Official-player auto-focus v974 dikekalkan.

## Tidak disentuh
PA/BM, JUPEM, payment, CAD converter, Repair PC, auth, More menu, katalog 25 Mana-Mana.
