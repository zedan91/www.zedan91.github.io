# AZOBSS Patch 1042 — GPS + Syit Piawai Database Recovery + JUPEM Live Fallback

Baseline: v1041. Package version: 1.0.1042.

## Stesen GPS
- Keeps the current 405 verified local GPS records for fast first-pass search.
- Updater now accepts JUPEM state-name aliases instead of discarding valid W.P./Federal Territory rows by exact-name mismatch.
- Adds `GET /api/stesen-gps?negeri=...&q=...` live JUPEM DataTable fallback.
- If a requested station is absent locally, Search and Tambah Terus ke Troli automatically retry against JUPEM live.
- Live results keep `productId`, direct JUPEM PDF URL, JUPEM map URL and AZOBSS Google Maps resolver URL.

## Syit Piawai
- Removes 31 known-bad Putrajaya rows that were actually Kuala Lumpur rows duplicated by the old state-code 14 bug.
- Local trusted index after cleanup: 6,107 rows.
- Correct updater state codes: Sabah 12, Sarawak 13, Kuala Lumpur 14, Labuan 15, Putrajaya 16.
- Adds `GET /api/syit-piawai?negeri=...&q=...` live JUPEM fallback using JUPEM anti-forgery token + session cookie.
- Missing local records, including Sabah/Sarawak/Putrajaya, are queried live rather than shown as unavailable immediately.
- Live Syit results include `productId`, `stateCode`, preview-compatible metadata, map link and controlled-download metadata.

## Deployment
`deploy-server.js` changed. Commit/upload all files to GitHub and **redeploy Render** so GPS/Syit live fallback becomes active. Static local data continues to work before Render redeploy, but missing-record fallback requires the backend.
