# AZOBSS Patch 1125

## PA map magnifier: reuse proven LIHAT PA preview script

- Peta Pilihan PA magnifier now uses the exact same `openPaPreview()` handler used by the working **LIHAT PA** magnifier in Carian Umum.
- Removed the separate/custom map preview click path.
- The map button only provides the same `data-pa-view-url` and `data-pa-view-name` attributes; fetching, parsing, image preview, metadata and Senarai Lot are all handled by `azobss-pa-search.js`.
- Keeps the existing map magnifier button and all v1124 search/state/legacy PA behavior unchanged.
- Cache-busters for `azobss-pabm-map-search.js` and `azobss-pa-search.js` bumped to v1125.

Package version: `1.0.1125`.

Frontend-only behavior change; no backend logic change is required for this patch.
