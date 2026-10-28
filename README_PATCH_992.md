# AZOBSS Patch v992 — AZOBSSTV Official Player Page Scroll Passthrough

Punca:
- Player rasmi Mana-Mana berada di dalam iframe cross-origin.
- Wheel/mouse input di dalam iframe dimiliki oleh document provider dan tidak
  bubble ke parent AZOBSSTV.
- v975 juga pernah mengunci cropped iframe dengan overscroll-behavior:none,
  menjadikan kawasan player lebih mudah menjadi "scroll trap".

Fix v992:
- overscroll-behavior official iframe/stage dipulihkan kepada auto.
- Ditambah 4 transparent parent-owned scroll bridge zones di atas bahagian
  video yang bukan control.
- Mouse wheel/trackpad pada zones tersebut terus scroll halaman AZOBSSTV.
- Touch vertical pan pada zones tersebut juga dibenarkan untuk scroll page.
- Kawasan berikut sengaja dibiarkan terus kepada iframe:
  1. bottom control bar,
  2. centre play/pause,
  3. top-right fit/extend.
- Jadi user masih boleh guna control player, tetapi majoriti ruang display
  tidak lagi memerangkap scroll halaman.

Tiada perubahan:
- Mana-Mana dynamic Live TV catalogue / EPG,
- Anime catalogue v991,
- Favorites/Recent cloud v990,
- playback source,
- payment / PA-BM / JUPEM / CAD systems.
