# AZOBSS Patch 1174 — PC Build Home Navbar + Live Malaysia Pricing

Baseline: v1173

## Changes
- `/PC-Build/` navbar now uses the same AZOBSS Home sticky navbar system, styles, dropdown script, authentication controls and PC & IT Services menu instead of the standalone custom navbar.
- PC & IT Services remains the active parent menu and `PC Build & Hardware` is marked as the active submenu on the PC Build page.
- Removed the standalone `Rujukan harga pasaran Malaysia` box from the bottom of the PC Build page.
- Added practical software-use information to every build, including AutoCAD year ranges and related CAD/GIS/BIM/creator software such as Civil 3D, Revit, Global Mapper, QGIS, ArcGIS Pro, SketchUp, Blender, Lumion, Twinmotion, Adobe apps and CUDA/AI where appropriate.
- Added public backend endpoint `/api/pc-build/live-prices`.
- Live prices are read from the exact source products used by the cards:
  - ALL IT Office Plus
  - ALL IT Aura Gaming RTX 5060
  - ALL IT Nova Gaming RX 9060 XT
  - Ideal Tech Radiance Stellar RTX 5070
  - ALL IT Phantom Gaming RX 9070 XT
  - Ideal Tech Radiance Apex RTX 5080
- Shopify sources use the matching RAM/no-software product variant where available; Ideal Tech WooCommerce sources use the current base product price.
- Backend live-price results are cached for 5 minutes to reduce load on the reference stores.
- The PC Build page refreshes prices on load and every 5 minutes while open.
- If the backend/source is temporarily unavailable, the page keeps rendering immediately with the last known fallback price and clearly shows that live pricing is unavailable.
- Added one automatic live-price retry to handle Render cold starts.

## Validation
- PC Build inline JavaScript syntax: PASS
- Backend `server.js` syntax: PASS
- `pc-build-data.json`: PASS
- Obsolete market-reference box: removed
- Home navbar shared assets/scripts: present
