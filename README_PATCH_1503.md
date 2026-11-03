# AZOBSS v1503 — Hardware Shop Exact Local Image Finalizer

- G1 PC Builds v1502 behavior is intentionally unchanged.
- G2 Hardware Shop now uses a dedicated verified local map only.
- 14 exact hardware targets are prepared into `PC-Build/images/products/hardware-v1503/`.
- Run `PREPARE-HARDWARE-IMAGES-v1503.bat` before deployment.
- The BAT reuses valid older local images where available, downloads missing exact images, validates image signatures, writes `local-hardware-map-v1503.js`, and builds `(1503)-AZOBSS-FULL-WEBSITE-HARDWARE-EXACT-LOCAL-FINAL_20261103.zip`.
- Do **not** deploy the PREPARER ZIP directly. Deploy the generated FINAL ZIP.
- If one exact image still fails, only that product uses a placeholder; other verified hardware images remain visible.
