# AZOBSS Patch 802 — Service Bookings Admin Auth Bridge Fix

Fixes **Admin authorization required** in Admin → Service Bookings.

## Cause
The main Admin Dashboard controller is an ES module. Its authenticated `azAdminFetchJson()` helper was therefore not available on `window`. The later classic Service Bookings script could not see it and silently used a plain unauthenticated `fetch()`, so the backend correctly returned HTTP 403.

## Fix
- Exposes the authenticated admin request helpers from the main module through `window`.
- Service Bookings waits briefly for the helper during startup.
- Removes the unsafe unauthenticated fallback entirely.
- Firebase ID token refresh/retry remains handled by the existing admin helper.
- All Patch 801 features remain unchanged.
