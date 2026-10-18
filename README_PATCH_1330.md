# AZOBSS v1330 — Affiliate Show More Scroll Lock

Baseline: v1329.

Fixes `/affiliate-shop/` description Show More modal scrolling:
- Wheel/trackpad input inside Show More is routed to the description scroller.
- Background page scroll is locked on both `html` and `body` while the modal is open.
- Previous inline overflow / overscroll styles are restored exactly when the modal closes.
- Scroll chaining is blocked with `overscroll-behavior`.
- Description body is a proper flex scroll area (`min-height:0`, `overflow-y:auto`).
- Existing v1329 compact cards, Show More formatting, v1328 strict Firestore import, v1325 bulk select/pin and v1324 Software Tools performance changes are preserved.

Package version: `1.0.1330`.
