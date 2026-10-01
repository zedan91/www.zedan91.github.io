# Patch 959 — Lot Map Cross Guide + Shape Order / Neutral Default

- Removes the large permanent Petak/Bulatan tooltip that covered resize handles.
- Replaces it with a center cross guide. Dimension labels show `Pusat → sisi` and `Sisi ↔ sisi`; the full area/width/height remains in the right-side readout.
- Petak is now the left button and Bulatan is the right button.
- Neither shape is pre-highlighted when the modal first opens. A shape becomes active only after the user clicks it, then drawing begins immediately.
- Petak edge-resize remains independent: dragging left/right/top/bottom moves only that edge. Cross dimensions refresh during resizing and lot selection refreshes on drag end.
- `/PA-BM/` cache-buster for `azobss-lot-selection-map.js` is raised to v959.
- No backend, pricing, payment, quota or CAD converter changes.
