# AZOBSS Patch 1074 — Home Register / Login Auth Fix

Baseline: v1073

Fixes:
- Repairs the malformed Google Profile modal injection in `azobss-global-auth.js`.
- v1073 accidentally stored literal `\n` sequences between JavaScript statements in the injected Google Sign-In block.
- This could prevent the global auth script from completing, leaving Home Register/Login visible but without a working modal/event handler.
- Restores normal Register and Login click handling.
- Google Sign-In + Complete Profile phone flow remains enabled.
- Cache-busts `azobss-global-auth.js` to `v=1074` across all pages.
- No navbar styling, PA/BM, payment, lot-selection, or backend logic changed.

Package version: `1.0.1074`
