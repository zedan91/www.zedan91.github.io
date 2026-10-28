# AZOBSS v1454 — v1453 + PA/BM Download Auto-Reset / Anti-Spam Restore

Base: `(1453) AZOBSS-FULL-WEBSITE-LIYABUDUN-STATIC-DATES-1.0.51_20261028_103411.zip`

Changes:
- Preserve Liyabudun 1.0.51 static date layout from v1453.
- Preserve Software Tools ordered Pin Order from v1450.
- Restore the v1451 deterministic PA/BM download UI release lifecycle that was missing in v1453.
- After browser handoff, clear busy/preparing/download-lock/click-claim/ARIA/spinner state on the current button and any replacement node created by purchase-list rerenders.
- Repeat safe UI cleanup at 0ms, 220ms, 850ms and 1800ms.
- Restore 3.5 second per-record+format cooldown to block double-click / repeated-click download spam.
- Legacy URL-only, ZIP/Lot, browser fallback and Blob download flows use the same cooldown/release logic.
- Cache-bust `azobss-global-auth.js` to v1454 wherever referenced so browsers do not keep an older PA/BM runtime.
- Download quota, expiry, pricing, payment and backend attempt-id behavior are unchanged.
