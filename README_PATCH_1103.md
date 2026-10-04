# AZOBSS v1103 — Lot/PA Shape Visibility Fix

Based on v1102.

## Changes
- Fixes cadastral Lot/PA geometry appearing to be missing in BM/SBM map search.
- Root cause: v1102 fitted the search reference together with many nearby BM/SBM stations, often zooming out to around z12–13. A real cadastral parcel then became only a few screen pixels and the red search pin could cover it.
- When the search reference is a Nombor Lot or Nombor PA, the initial map view now focuses the exact returned JUPEM polygon first (up to zoom 18, minimum target zoom 16).
- The selected Lot/PA polygon uses a dedicated high-z-index Leaflet pane, a stronger yellow outline/fill and a permanent Lot/PA label so it remains distinguishable from BM/SBM markers.
- The real JUPEM geometry is not enlarged or altered.
- Clicking a BM/SBM result still fits the search origin and selected station together and keeps the dashed distance line + distance label from v1102.
- WGS84 searches without a cadastral reference keep the previous fit behavior.

## Deployment
Frontend/static deployment only. Render backend redeploy is not required.
