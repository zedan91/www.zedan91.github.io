# AZOBSS 1056 — Global Render Smart Wake / Cold-Start Prewarm

## Baseline
- Built from v1055.
- Payment recovery, stickybar, numbering and all existing backend logic remain unchanged.

## Goal
Start the Render cold-start before the customer performs Search, Download, Buy/Pay, Checkout or other backend-dependent actions.

## Changes
1. Added `/assets/js/azobss-render-wake.js` and loaded it near the top of `<head>` on all production AZOBSS HTML pages.
2. Immediately calls the main Render `/health` endpoint when an AZOBSS page is entered.
3. Uses cross-page localStorage cooldowns so Home → Software → CAD → PA/BM does not spam duplicate wake requests.
4. Wakes again when a browser tab becomes visible after returning from ToyyibPay / banking app / another tab.
5. Pre-warms on Search / Download / Buy / Pay / Checkout intent (hover, focus, touch).
6. Starts a keepalive-safe wake while an internal navigation is pressed, allowing cold-start to begin before the next page finishes loading.
7. Active-session refresh: while the tab is visible and recently used, warm state is refreshed before becoming cold. Background/inactive tabs do not keep Render awake indefinitely.
8. Lucky Draw page also wakes `https://azobss-lucky-draw-api.onrender.com/api/health` because it uses a separate Render service.
9. Existing Software Tools v1039/v1040 helper is supported through the compatibility alias `window.azobssWakeRenderSmart1040`.

## Safety / load control
- Successful warm state TTL: 7 minutes.
- Attempt cooldown: 30 seconds across pages.
- Request timeout: 25 seconds.
- All wake requests are fire-and-forget and never block normal page actions.

## Deployment
- Website deploy only.
- `deploy-server.js` is unchanged; no Render backend redeploy is required for this patch.

## Debug
Browser console:
```js
window.azobssRenderWakeStatus1056()
```
