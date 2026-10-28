# AZOBSS Patch 945 — Lot Kadaster Download Loading Spinner

Date: 2026-08-17

- Adds a compact animated loading spinner to ZIP / DWG / DXF buttons while a controlled Lot Kadaster download is preparing or downloading.
- Busy buttons keep the short format label (ZIP, DWG, DXF) next to the spinner, instead of showing long text such as `Muat DWG...` that can overlap adjacent controls.
- Uses the existing `data-busy="1"` / `aria-busy="true"` state, so no change is made to download quota, backend conversion, or purchase logic.
- Applied to `/PA-BM/`, root fallback markup, and the shared stylesheet.
- Backend/DWG converter remains v944; this is a frontend-only patch and should not trigger the Render backend build filter.
