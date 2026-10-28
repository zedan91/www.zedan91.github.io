# AZOBSS Patch 1153 — Lot Kadaster DWG Direct-ZIP Recovery Fix

Baseline: `(1152)-AZOBSS-PA-BM-LOT-STALE-JOB-AUTO-REGEN-FIX_20260924.zip`

- Fixes the case where the Lot Kadaster **ZIP** button still works but the displayed **DWG** button fails after the old ArcGIS GP job has already been purged.
- Root cause: v1152 probed the surviving direct ZIP before job status for ZIP delivery, but CAD conversion still entered `azobssWithRegisteredJupemLot()` first; that function re-checks the GP job and rejects `Deleted/TimedOut/Failed` jobs even when the ZIP itself is still downloadable.
- CAD conversion now tries `azobssEnsureLotCachedZip()` directly first. If the direct ZIP is valid, it is cached and converted immediately without re-registering/re-checking the stale GP job. GP registration remains as the fallback only when no direct ZIP is available.
- The two-button UI remains **ZIP + DWG**, but the DWG button now uses the real `format=dwg` action instead of the old v947 DXF action relabelled as DWG.
- DXF legacy action is hidden/removed from the two-button storefront UI.
- Download quota is still incremented only after a real CAD file has been generated successfully.
- Cache-busters for `/PA-BM/` shared download scripts are raised to `v=1153`.
