# AZOBSS Patch 1118 — Lot Kadaster Tile Load Stabilization

## Scope
Frontend-only performance/reliability fix for **Lot Kadaster Berdigit / Lot Kadaster Berdigit C3** map. PA/BM/SBM/GPS map behaviour is not changed.

## Fixes
- Removes `scope=all` from Lot Kadaster tile requests; only the active state is rendered.
- Combines lot + sheet overlays into one JUPEM tile request, roughly halving normal cadastral tile traffic.
- Stops requesting new JUPEM tiles continuously while the user is zooming; tiles are loaded after the viewport settles.
- Reduces Leaflet `keepBuffer` from 4 to 1 to avoid hundreds of off-screen ArcGIS export requests.
- Replaces whole-layer redraw recovery with per-tile retry (up to 4 attempts with backoff).
- Avoids forced whole-layer redraw after every zoom/move.
- Earth complementary cadastral overlay receives the same throttling/retry behaviour.
- Correct cache-buster for `azobss-lot-selection-map.js` is now `v=1118` (previous page still referenced `v=1108`, so browsers could keep stale map code).

## Deploy
Frontend only. GitHub Pages deployment / hard refresh is sufficient. Render backend does not need redeploy.
