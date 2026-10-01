# Patch 960 — Lot Map Center-to-Side Distance Guide

- Simplifies the cross-guide labels on Petak/Bulatan: only the center-to-side distance value is shown (for example `480 m`).
- Removes the explanatory words `Pusat → sisi` and all `Sisi ↔ sisi` values from the map overlay because the right-side panel already contains the full dimensions.
- Horizontal cross distance text stays horizontal.
- Vertical cross distance text is rotated vertically to follow the vertical guide line.
- Guide text is enlarged from 9px to 12px and made heavier for easier reading without covering resize handles.
- Bulatan now shows the radius value on both horizontal and vertical guide axes.
- Full width/length/area/hectare information remains unchanged in the right-side panel.
- `/PA-BM/` cache-buster for `azobss-lot-selection-map.js` is raised to v960.
- No backend, pricing, payment, quota or CAD converter changes.
