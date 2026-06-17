# (173)-AZOBSS Commission Firestore Retry Fix

Patch focus:
- Fix staff/share commission not appearing after payment success.
- Add commission retry on ToyyibPay return route.
- Store returnUrl/ref info in premium order so share ref can still be detected later.
- Add backend endpoints for commission diagnostics:
  - GET /api/commission/status
  - POST /api/commission/retry-order

No Firebase Rules update required when using backend Admin SDK.
Required Render env on azobss-backend:
- FIREBASE_SERVICE_ACCOUNT_JSON
