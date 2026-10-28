# Patch 955 — Unified Purchase Download Action

- Fixes the remaining generic PA/BM Download sizing conflict by removing the v952/v953/v954 generic override blocks.
- Generic PA/BM Download now uses the exact same DOM structure and CSS classes as Lot Kadaster ZIP/DWG (`az-lot-download-action`, `az-lot-download-format-group`, `az-lot-format-download`).
- Therefore the Download button is exactly the same 42x24 desktop footprint as ZIP/DWG, while the existing busy state uses the same real moving spinner.
- Download count and `Reset 0/5` now inherit the exact same sizing rules as Lot Kadaster instead of separate copied values.
- Module cache busters are updated to v955.
- No backend, quota, payment, CAD converter, or Render Docker changes.
