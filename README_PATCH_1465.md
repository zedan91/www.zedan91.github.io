# AZOBSS v1465 — Upgrade Parts Hardware Visuals

Based on v1464.

## Changes
- Added local, brand-neutral SVG hardware illustrations to `/Upgrade-Parts/` for:
  - RAM DDR modules
  - SATA SSD / M.2 NVMe
  - HDD
  - GPU
  - PSU
  - Cooling / fan
  - Wi-Fi / Bluetooth
  - Laptop battery
  - Adapter / charger
- Images are stored locally under `Upgrade-Parts/assets/hardware/`; no external hotlinks.
- Added lazy-loading and async decoding for hardware visuals.
- Added responsive image sizing, subtle card hover zoom, and matching dark AZOBSS visual treatment.
- Preserved all v1464 detailed hardware specifications, live/fallback pricing, compatibility guidance, and estimator logic.
- Global version badge/cache-bust bumped to v1465.

## Deployment
Archive remains flat/root-ready. Render can keep `Root Directory: backend`.
