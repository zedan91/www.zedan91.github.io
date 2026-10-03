# AZOBSS v1018 — Canvas-Safe Movable Reference Rectangle Fix

## Punca sebenar v1017 tidak boleh drag
Peta Lot Kadaster dibuat menggunakan Leaflet `preferCanvas: true`. Petak rujukan ialah vector Canvas, jadi `radiusReferenceShapeLayer.getElement()` tidak mengembalikan SVG/DOM path yang boleh menerima `pointerdown`. Oleh itu listener drag v1017 tidak pernah dipasang.

## Pembaikan v1018
- Kekalkan petak visual pada Canvas seperti sedia ada.
- Tambah transparent **SVG drag-capture rectangle** khusus di pane `azLotReferenceMovePane`.
- Pane berada di atas layer Canvas lot/petak tetapi di bawah marker resize handles.
- Drag di mana-mana dalam isi Petak mengalihkan keseluruhan petak tanpa mengubah Lebar/Panjang.
- Titik pusat, 4 resize handles, cross guide dan label ukuran bergerak bersama secara live.
- Pointer capture digunakan supaya drag terus stabil walaupun cursor keluar dari petak.
- Map panning dimatikan sementara ketika drag dan dipulihkan selepas pointer dilepas.
- Pemilihan lot dikira semula sekali selepas drag selesai.
- Mouse, pen dan touch menggunakan Pointer Events.
- Empat handle tepi kekal untuk resize, bukan move.

## Cache/version
- `/PA-BM/` cache-buster `azobss-lot-selection-map.js` → `v=1018`.
- Package version → `1.0.1019`.

Tiada perubahan pada harga, checkout, backend JUPEM, algoritma intersection lot, Live TV, Anime atau Movies.
