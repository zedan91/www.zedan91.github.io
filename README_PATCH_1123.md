# AZOBSS Patch 1123

## PA map magnifier preview

- Adds a compact magnifying-glass button beside **Tambah PA... ke Troli** inside **Peta Pilihan PA**.
- The button opens the existing PA detail preview used by the PA search table, showing the rough PA plan image, PA metadata and **Senarai Lot**.
- Lot numbers inside the preview keep their existing map-focus action, so a user can inspect an individual lot after viewing the PA overview.
- The magnifier is shown only when a safe PA-detail URL is available; it stays hidden for unresolved PA records.
- Direct `PAxxxx` map searches now carry the PA preview URL from the exact selected-state PA record to every resolved lot.
- Lot-number searches also carry the preview URL whenever the exact PA match provides it.
- No price, cart, payment, selected-state priority, geometry, BM/SBM/GPS or cadastral-tile logic was changed.
- Cache-busters for `azobss-pabm-map-search.js` and `azobss-pa-search.js` bumped to v1123.

Package version: 1.0.1123
Frontend + backend deploy required.
