# AZOBSS Patch 1203 — PA/Lot ArcGIS-First Search Recovery

- Cari Lot now uses the JUPEM cadastral ArcGIS layer as the primary backend source.
- Cari PA now tries PA attributes on the cadastral ArcGIS layer first; the JUPEM HTML product form remains a compatibility fallback.
- Frontend no longer falls back directly to JUPEM from the browser, so Firefox CORS/NetworkError no longer overwrites the useful backend error.
- PA/Lot backend requests retry once and use the configured AZOBSS backend base.
- PA search timeout increased to 60 seconds.
- PA/BM cache-busters raised to v1203.
- Frontend and Render backend must both be redeployed.
