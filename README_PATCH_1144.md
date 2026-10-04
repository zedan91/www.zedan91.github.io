# AZOBSS v1144 — Download Spinner Single Owner + Verified Health Endpoint Fix

Baseline: v1143.

Root cause verified from the actual package:
- deploy-server.js exposes `GET /health` and returns `{ ok: true, ... }`.
- v1142/v1143 incorrectly changed the wake check to `/api/health`.
- The full controlled-download implementation also existed in both `azobss-global-auth.js` and `azobss-firebase-live-likes-sync.js`; live-sync could overwrite the global window function after global-auth loaded.
- The old spinner depended on a child `<span>` that could be lost when Purchase Records re-rendered.

Fixes:
- Wake endpoint restored to `https://azobss-backend.onrender.com/health`.
- `azobss-global-auth.js` is the real single owner of `window.azobssClientControlledDownload`; live-sync is fallback only.
- Spinner is now a CSS pseudo-element on the busy button itself, not a replaceable child node.
- Static inline spinner CSS is included on `/PA-BM/`, plus JS fallback CSS.
- Two animation frames are yielded before starting the wake request so Chrome/Firefox can paint the spinner.
- Busy state is visible for at least 900 ms on every click, including Administrator `Test ↓`.
- No fullscreen overlay/modal. Only the clicked button spins.
- Existing quota / exact-once / reset logic remains unchanged.

Deploy: frontend only for these changes; backend source is unchanged. Hard refresh after deploy.
