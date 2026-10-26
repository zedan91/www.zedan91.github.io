# AZOBSS v1430 — PC 15 Store Internal Catalog

- 15 retailer JSON files under `PC-Build/retailers/`.
- `PC-Build/retailers/index.json` is the manifest.
- 121 total retailer records: 115 priced snapshots + 6 quote-required records.
- `/PC-Build/` loads AZOBSS builds and all retailer JSON into the same searchable grid.
- Main store filter supports `Semua sumber`, `AZOBSS`, and each retailer.
- Public users stay inside AZOBSS; retailer source URLs are shown only to administrators for audit/provenance.
- Retailer prices are snapshots, not AZOBSS selling prices and do not receive AZOBSS markup.
- Stores without a stable public current price are marked `quote-required`; no price is invented.
- Live-price backend continues to update AZOBSS builds only.
