# AZOBSS Patch 1201 — Lot Kadaster Fast Status Processing

Baseline: v1200.

- Fixes slow `Sedang Diproses` polling for large Lot Kadaster selections.
- Status endpoint now checks the ArcGIS GP job first and returns 202 immediately while it is still running.
- ZIP registration/probing happens only after the GP job reports `esriJobSucceeded`.
- Existing legacy/download direct-ZIP recovery remains unchanged for other callers.
- Frontend polling interval reduced to 2s and shows lot count, current job status and elapsed time.
- Removes the misleading fixed `1~2 minit` promise; duration depends on lot count and upstream server load.
- No changes to lot selection geometry, strict positive-area intersection, natural lot geometry, pricing or checkout rules.
