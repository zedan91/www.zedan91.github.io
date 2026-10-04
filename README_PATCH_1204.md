# AZOBSS v1204 — Lot Kadaster Processing ETA

Built directly from v1203 CAD No-Syit Fast.

## Change
- Lot Kadaster processing now shows a user-facing estimated progress percentage, elapsed time and estimated remaining time.
- Initial ETA is based on conservative lot-count buckets (1-25, 26-100, 101-250, 251-500, 501-1000, 1001-2000, 2001+).
- After a successful job, the browser stores the real duration for that lot-count bucket and uses a rolling average of the latest 12 successful jobs, so future estimates become closer to actual server speed.
- The selection summary also shows an estimated processing range before the user presses `Sediakan & Tambah ke Troli`.
- ETA is explicitly an estimate; ArcGIS/server load can still make a job exceed the usual range.
- v1203 no-Syit CAD, v1201 fast status polling, and all v1200 features remain unchanged.

## Deployment
Frontend/GitHub Pages redeploy is sufficient for this ETA UI change. Render backend is unchanged from v1203.
