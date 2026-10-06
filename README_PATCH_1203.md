# AZOBSS v1203 — Lot Kadaster CAD No-Syit Fast Conversion

Built directly from v1202.

## Change
- Lot Kadaster DXF/DWG conversion now completely ignores Syit Piawai.
- Backend no longer queries Syit Piawai geometry, resolves a second sheet CRS, retries sheet auth, or downloads/processes sheet geometry for Lot CAD.
- Generated CAD contains only the purchased cadastral content: `PER NDCDB`, `NOLOT`, and `NOPA`.
- `SYIT_PIAWAI` and `SYIT_LABEL` are no longer added to new Lot CAD DXF/DWG output.
- Converter cache version bumped to `1203.1` so old CAD files that included/attempted sheet layers are not reused.
- The separate Syit Piawai (Gambar) product/storefront is unchanged.
- v1201 fast status processing and all v1200 features remain unchanged.

## Deployment
Render backend must be redeployed because the speed improvement is in `deploy-server.js` and the CAD converter.
