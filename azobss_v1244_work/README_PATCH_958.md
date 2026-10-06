# Patch 958 — Direct Area Selection + Auto Lot Selection + Independent Petak Edge Resize

- The visible `Pilih lot dalam kawasan rujukan` checkbox is removed. Reference-area lot selection is always enabled automatically.
- `Rujukan Kawasan` is renamed to `Pilih Kawasan Lot`.
- The separate `Lukis Rujukan Bulatan/Petak` button is removed. Clicking `Bulatan` or `Petak` immediately starts drawing that shape.
- `Petak` becomes independently resizable after drawing: four draggable handles appear at the left, right, top and bottom edges. Dragging one handle moves only that edge; the opposite edge stays fixed, so this is not center-based rescaling.
- Petak readout now reports `Lebar`, `Panjang`, `Luas petak`, and Hektar/Ekar. Lot selection is recalculated after an edge resize ends.
- Bulatan keeps the existing center-to-edge drawing flow and automatic lot selection.
- Manual Leaflet polygon/rectangle selection remains available and replaces any active reference area when used.
- `/PA-BM/` cache-buster for `azobss-lot-selection-map.js` is raised to v958.
- No backend, pricing, quota, payment, CAD converter, or Render Docker changes.
