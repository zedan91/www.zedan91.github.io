# AZOBSS Patch 1154 — Lot Kadaster ZIP + DXF Restore

- Baseline: v1153.
- The user-facing Lot Kadaster download choices are restored to exactly **ZIP + DXF**.
- **DWG is removed from the purchase UI** because its converted text placement can become scattered/misaligned.
- The DXF button uses the real `format=dxf` backend action and downloads a `.dxf` file.
- v1153 direct-ZIP recovery is retained for CAD conversion, so DXF can still be produced from a valid source ZIP even when the old GIS job has already been purged.
- Existing stale-job auto-regeneration, quota protection, backend wake/retry, and spinner-until-file-handoff logic remain unchanged.
- `/PA-BM/` shared script cache-busters are raised to `v=1154`.
- Package version: `1.0.1154`.
