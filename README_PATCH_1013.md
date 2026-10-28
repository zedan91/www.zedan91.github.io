# AZOBSS Patch v1013 — Live TV Local Artwork Persistence Fix

## Punca
- Live TV mula-mula menggunakan `free.m3u`, tetapi katalog online Mana-Mana kemudian menggantikan senarai itu.
- `logo` daripada katalog online boleh kosong atau menggunakan URL imej pihak ketiga yang gagal hotlink di browser.
- Apabila itu berlaku, kad seperti TV1 / TV2 / TV OKEY / SUKAN+ / BERITA RTM jatuh kepada kotak huruf walaupun artwork tempatan boleh disediakan.

## Fix v1013
- Tambah peta `LOCAL_LIVE_ARTWORK` untuk semua 26 channel Live TV Mana-Mana yang diketahui.
- Katalog online kini diperkaya semula dengan artwork tempatan berdasarkan slug channel sebelum ia menggantikan katalog pada skrin.
- `replaceLiveCatalog()` juga menguatkuasakan artwork tempatan, jadi refresh/background sync tidak boleh membuang gambar lagi.
- `free.m3u` ditukar kepada aset tempatan untuk TV1, TV2, TV OKEY, SUKAN+, BERITA RTM, TVS, TV ALHIJRAH, SUKMA 1, SUKMA 2 dan DW.
- TV1, TV2, TV OKEY, SUKAN+ dan TV AlHijrah menggunakan imej tempatan; channel yang sebelum ini tiada artwork mempunyai card SVG tempatan yang stabil.
- Artwork sedia ada untuk BERNAMA, CNA, Al Jazeera, Arirang, Euronews, TaiwanPlus, NHK World, RT, USIM TV, Selangor TV, TVIKIM dan lain-lain dikekalkan.
- Tiada perubahan pada player/stream resolver atau sekatan embed v1012.

## Version
- AZOBSSTV app version: `1.0.1013`
- Service worker cache: `azobsstv-v1013`
