# AZOBSS Patch v994 — AZOBSSTV Anime Wide Card / Full Title Fit

Punca:
- Grid umum AZOBSSTV menggunakan 5 kolum pada desktop.
- Walaupun v993 sudah membuang ellipsis, ruang teks Anime masih terlalu sempit.
- `overflow-wrap:anywhere` juga membolehkan browser memecahkan perkataan di tengah.

Fix:
- Tab Anime kini menggunakan grid khas yang lebih lebar:
  - Desktop: 3 kolum
  - <=1100px: 2 kolum
  - <=680px: 1 kolum
- Poster Anime dibesarkan sedikit supaya kad nampak seimbang.
- Tajuk kekal penuh tanpa `...`.
- Perkataan tidak lagi dipotong di tengah seperti `Bookwor / m`.
- Tinggi kad berkembang secara semula jadi mengikut tajuk.

Live TV, EPG, player, Favorites/Recent cloud dan backend logic tidak diubah.
