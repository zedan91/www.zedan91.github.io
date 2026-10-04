# AZOBSS Patch 963

## AZOBSSTV integration

- Added public section `/AZOBSSTV/` and AZOBSSTV quick-navigation links across the existing AZOBSS sticky navigation pages.
- Added `/admin/AZOBSSTV/` and a direct AZOBSSTV entry in the existing Admin Dashboard sidebar.
- Added native backend endpoints under `/api/azobsstv/*` without introducing Express or replacing the existing `deploy-server.js` architecture.
- Remote Config follows the observable PerfectTV-style contract, including alias keys, `allowed_domains`, and `allow_all_domains` / `mode=all` behavior.
- Device Ping supports `launch` and foreground-only heartbeat every 30 seconds. Device identity, username extraction, account metadata, app version and client information are recorded; playlist passwords are not added to the telemetry payload.
- Notifications are polled every 60 seconds while the page is foregrounded.
- Added free M3U endpoint, XMLTV EPG endpoint, Favorites, Recent, Live TV, Movies, Series, Radio and TV Guide UI.
- Added safe backend playlist/EPG fetch fallback for CORS-limited sources. It validates every redirect, blocks private/local IP targets (SSRF hardening), enforces the AZOBSSTV allowlist/config, and does not act as a video-stream proxy.
- Added Firebase Admin-compatible AZOBSSTV admin authentication using the existing AZOBSS admin identity flow, with optional `AZOBSSTV_ADMIN_TOKEN` fallback.
- Added Active Devices, recent heartbeat records, notification management and Remote Config management in the AZOBSSTV admin page.
- PWA service worker only caches same-origin app shell assets and intentionally avoids caching API/media stream traffic.
- `free.m3u` remains intentionally empty. Add only streams AZOBSS is authorized to distribute or that the user is authorized to access.
- No PA/BM selection, pricing, payment, CAD converter, JUPEM or existing login flow was replaced.

## Backend endpoints

- `GET /api/azobsstv/health`
- `GET /api/azobsstv/config`
- `POST /api/azobsstv/device/ping`
- `GET /api/azobsstv/notifications`
- `GET /api/azobsstv/playlist/free`
- `GET /api/azobsstv/epg`
- `POST /api/azobsstv/playlist/fetch`
- `POST /api/azobsstv/epg/fetch`
- `GET|POST /api/azobsstv/admin/config`
- `GET /api/azobsstv/admin/devices`
- `GET /api/azobsstv/admin/heartbeats`
- `GET|POST /api/azobsstv/admin/notifications`
- `DELETE /api/azobsstv/admin/notifications/:id`

## Firestore collections

- `azobsstv/config`
- `azobsstvDevices/{device_id}`
- `azobsstvHeartbeats/{auto-id}`
- `azobsstvNotifications/{auto-id}`

For heartbeat retention, configure a Firestore TTL policy if long-term logs are not required.
