# AZOBSS v1467 — Upgrade Parts Modern Full Hardware Photos

Based on full v1466.

## Changes
- Replaced outdated/legacy-looking Upgrade Parts photos with newer real hardware references: DDR5 RAM, Samsung 990 PRO NVMe, newer SATA HDD, RTX 4090-class GPU, modern modular ATX PSU, modern tower cooler, Wi-Fi 6 M.2, modern internal laptop battery and newer laptop adapter.
- Fixed image cropping by forcing all real hardware cards to a fixed product stage with `object-fit: contain`.
- Disabled real-photo zoom/crop hover so the complete hardware remains visible.
- Increased visual stage height on desktop and kept a compact responsive height on mobile.
- Updated photo credits/licenses.
- Existing detailed pricing, estimator, live-price sync, fallback pricing and compatibility information remain unchanged.
- Global version badge/cache-bust raised to v1467.

## Deployment
ZIP remains flat/root-ready: `index.html`, `backend/`, `assets/`, `Upgrade-Parts/`, etc.
