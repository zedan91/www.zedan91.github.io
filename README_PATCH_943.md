# AZOBSS Patch 943 — DWG R14 Recovery Reduction + Middle Center TEXT

Date: 17 August 2026

## Changes

- DWG lot/PA labels are genuine AutoCAD **TEXT / Justify: Middle Center** again.
- DWG-only internal DXF now uses a **dual-anchor** TEXT representation:
  - group 11/21 = exact lot-centre alignment point
  - 72 = Center, 73 = Middle
  - group 10/20 = safe pre-offset fallback insertion point
- This avoids the old case where both insertion and alignment points were identical and LibreDWG could move labels away from their lots.
- Final sanitation now rewrites the DWG to **AutoCAD R14 / AC1014**, a simpler DWG generation target, instead of R2000. The drawing only contains LINE/TEXT/basic layers, so no required cadastral content depends on newer DWG features.
- Health endpoint reports `dwgOutputVersion: AutoCAD R14 / AC1014` and `dwgTextJustification: Middle Center`.
- Public DXF remains AC1027 and unchanged.
- Fast Docker layer cache/build filter from v941 is retained.

## Version

Package: `1.0.943`  
CAD converter/cache: `943.1`  
Health patch: `943`

## Important

LibreDWG is still a reverse-engineered DWG writer. R14 is used here because the AZOBSS cadastral output only needs basic LINE/TEXT/layer entities and older DWG structures are less complex. Final verification must still be done with a freshly downloaded DWG in AutoCAD after deployment.
