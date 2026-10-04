# AZOBSS Patch 1041 — Full BM + SBM Database Restore + JUPEM Live Fallback

- Restored archived full benchmark dataset into `stesen-tanda-aras-records.json`.
- 27,845 records: 26,844 BM (`jenis=1`) + 1,001 SBM (`jenis=2`).
- Normalized all prices to current AZOBSS RM3 and all known product IDs to the AZOBSS backend download gateway.
- Preserved all 14,701 coordinate pairs available in v1040.
- Normalized archived Federal Territory state aliases (W.P/W. Persekutuan) to the current dropdown names for Kuala Lumpur, Labuan, and Putrajaya.
- Removed the legacy Home BM/SBM 50-result truncation.
- Home and `/PA-BM/` now search local full DB first; zero local results automatically trigger JUPEM live fallback.
- `/PA-BM/` Quick Add also uses JUPEM live fallback when a station/productId is missing locally.
- Live parser extracts product ID, BM/SBM type, AZOBSS download URL, and JUPEM map URL when present.
- Live endpoint rate limit: 60 requests/minute/IP; parser defensive ceiling: 1,000 rows.
- Cache-buster: `20260826-full-bm-sbm-live-fallback-1041`.
- Package version: 1.0.1041.

## Important deployment
`deploy-server.js` changed, so redeploy Render after committing/uploading v1041. Static GitHub deployment alone restores the full local BM/SBM database; JUPEM live fallback becomes active after the Render backend is redeployed.
