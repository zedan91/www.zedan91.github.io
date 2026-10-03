# AZOBSS Patch 947 — Lot Kadaster Two-Button UI Hard Fix

- Latest Purchase List Lot Kadaster now shows only **ZIP** and **DWG**.
- The displayed **DWG** button still calls the existing **DXF** download action (`data-download-format="dxf"`); this patch changes UI text only as requested.
- The old real-DWG button (`data-download-format="dwg"`) is removed/hidden defensively.
- Added a MutationObserver safety layer so rerenders from either purchase-list renderer cannot restore the third button.
- Loading spinner keeps `DWG` as its visible label while busy.
- Cache-buster for the two purchase renderer modules increased to `v=947`.
- No backend, quota, converter, or Render Docker changes.
