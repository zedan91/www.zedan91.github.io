# Patch 957 — Download Used Icon + Quota/Reset Alignment

- Replaces the long `Digunakan` label for exhausted PA/BM downloads with a compact lock icon (`🔒`).
- The exhausted icon uses the same 42×24 desktop footprint as the normal download / Lot Kadaster ZIP-DWG buttons.
- The used count (`5/5`) and `Reset 0/5` inherit the same compact sizing as Lot Kadaster rows.
- Both purchase renderers (`azobss-global-auth.js` and `azobss-firebase-live-likes-sync.js`) use the same exhausted-state markup, preventing renderer differences.
- Cache-busters for the affected renderers are raised to v957.
- No backend, quota logic, payment logic, CAD converter, or Render Docker changes.
