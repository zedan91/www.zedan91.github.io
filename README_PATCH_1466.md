# AZOBSS v1466 — Upgrade Parts Real Hardware Photos

Based on full v1465.

## Changes
- Replaced the Upgrade Parts vector/illustration cards with real hardware photographs for RAM, NVMe SSD, HDD, GPU, PSU, CPU cooling, Wi-Fi card, laptop battery and laptop adapter.
- Photos use stable Wikimedia Commons 960px image URLs with explicit alt text and lazy loading.
- Existing local SVG files are retained only as automatic onerror fallbacks.
- Added a collapsed photo-credit section with source/author/license information.
- Real-photo CSS uses contain/cover per component to keep each card visually balanced on desktop and mobile.
- All detailed hardware/specification/pricing logic from v1464/v1465 is preserved.
- Global version badge/cache-bust raised to v1466.

## Deployment
ZIP remains flat/root-ready: index.html, backend/, assets/, Upgrade-Parts/, etc.
