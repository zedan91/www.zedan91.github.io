# AZOBSS Patch 1181 — PC Build Sendiri / Compatibility + Live Upgrade Pricing

Date: 2026-10-01
Package: 1.0.1181
Baseline: v1180

## What changed

- Added **Build Sendiri** directly in `/PC-Build/`.
- Each ready-made PC card now has **Ubah / Build Sendiri** and seeds the customizer from that tier.
- Builder groups: Processor, CPU Cooler, Motherboard, RAM, Graphics Card, Storage, PSU, Casing, Windows and Microsoft Office.
- Customer sees only AZOBSS selling price and approximate AZOBSS option difference.
- Administrator additionally sees market base cost, upgrade market cost, markup percentage/amount and reference source.
- Share Build generates a URL fragment containing selected component IDs; opening it restores the configuration and recalculates the current live price.
- Copy Spec and Salin & WhatsApp flows are included.

## Price model

1. Start from the live/fallback market cost of the selected AZOBSS base build.
2. Add current/fallback market deltas for selected upgrades.
3. Run compatibility checks.
4. Apply the existing AZOBSS tiered markup **once** to the final market cost.
5. Apply the v1178 varied deterministic retail ending.

This prevents markup-on-markup when several upgrades are selected.

## Live upgrade references

`deploy-server.js` now exposes:

- `GET /api/pc-build/live-prices`
- `GET /api/pc-build/custom-market`

`custom-market` reads `PC-Build/pc-custom-builder-data.json`, fetches only whitelisted reference pages defined in the catalog, extracts the current RM upgrade delta near the matching product name and caches results for 5 minutes. If a source cannot be read, the catalog fallback remains active.

Important production fix: Render starts `deploy-server.js`; therefore the PC Build live-pricing route is now present in that production entrypoint as well, rather than existing only in `backend/server.js`.

## Compatibility checks

- CPU socket vs motherboard platform.
- Higher CPU class requiring stronger VRM/motherboard tier.
- CPU cooling class requirement.
- GPU minimum PSU wattage.
- ATX motherboard vs mATX-only case.
- 360 mm AIO vs casing without 360 mm support.
- Gen5 SSD vs motherboard without Gen5 M.2 support.
- 32 GB RAM recommendation for heavier CAD/Revit/rendering tiers.

Invalid combinations disable the Salin & WhatsApp action until corrected.

## Ideal Tech public behaviour studied

The public Ideal Tech builder exposes category rows for choosing individual parts and shows quantity/total pricing. Their package product pages use a base configuration plus `+RM` upgrade deltas, including promotional replacement prices. Public pages also expose compatibility requirements such as stronger motherboard/VRM requirements for selected CPUs, 360 mm AIO casing limitations, and Gen5 SSD motherboard requirements. Public quotation pages persist product lines, prices, quantities and totals in a shareable quote URL.

AZOBSS does not copy any private API or private source code. v1181 implements the observed public pricing/compatibility model with AZOBSS-owned UI and pricing rules.
