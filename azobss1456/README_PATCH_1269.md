# AZOBSS Patch 1269 — Lot Kadaster Small-Selection Fast GP Route

Baseline: v1268.

## Diagnosis
The UI was not frozen at 95%. `esriJobExecuting` is a real upstream JUPEM ArcGIS GP status. The progress percentage is only an ETA and intentionally caps near 95% while the GP job has not completed.

The slow path was introduced by the v928 export strategy: `Layers_to_Clip` tries a cadastral layer URL + OBJECTID filter before the literal selected feature set. JUPEM can accept that input but still spend a long time opening/scanning the source layer. This is especially wasteful for small selections such as the 20-lot case.

## Fix
- For 1–100 selected lots, submit the **exact selected feature set first** (the proven pre-v928 approach), while retaining the v928 exact-selected-lot AOI guard.
- If JUPEM rejects that input, automatically fall back to the existing layer-reference path.
- For >100 lots, keep the compact layer-reference-first strategy to avoid very large POST payloads.
- Preserve strict visible-line selection, natural/full lot geometry, exact selected-lot AOI, pricing, cart, checkout and authentication logic.
- Processing UI now states that a prolonged 95% means JUPEM is still executing, not that the browser is frozen, and marks the fast route when active.

## Deployment
Render/backend redeploy is required because the fast-path submission logic is in `deploy-server.js`. Frontend cache for the lot map is bumped to v1269.
