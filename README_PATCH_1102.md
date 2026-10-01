# AZOBSS v1102 — Search Origin Pin + BM/SBM Distance Guide + Double-click Map Search

Based on v1101.

## Changes
- PA/BM/SBM map search now shows a prominent search-origin pin labelled `Lokasi carian` at the coordinate/reference used for the search.
- BM/SBM: selecting a station draws a dashed line from the search-origin pin to the selected BM/SBM station.
- The selected line displays the distance in km directly on the line.
- Selecting a different BM/SBM immediately moves the distance guide to the new station.
- Clicking a BM/SBM result keeps both the search origin and selected station visible where possible.
- Free-map location search is now triggered by **double-click**, not single-click, preventing accidental new searches while dragging/panning the map.
- Leaflet double-click zoom is disabled inside these map modals so double-click is dedicated to setting a new search point.
- Existing single-click behavior for selecting an already-found lot/station remains unchanged.
- Map instructions now tell customers to double-click when choosing a new map location.

## Deployment
Frontend/static deployment only. Render backend redeploy is not required.
