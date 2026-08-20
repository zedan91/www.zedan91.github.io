# AZOBSS Patch 873 — Admin Auto Update Sounds on Page Entry

- Based on Patch 872.
- When a verified AZOBSS admin opens `/Sound-Effects/`, the page automatically triggers `Update Sounds` once after Firebase admin authentication is confirmed.
- No manual click is required for the normal update check.
- The existing `Update Sounds` button is retained as a manual re-check/fallback.
- The automatic trigger runs once per page load/visit only, preventing repeated update requests from Firebase auth-state callbacks.
- It uses the same authenticated `/api/sound-effects/update-recent` flow, duplicate skipping, Recent category repair, Firestore storage and status UI from Patch 868+.
- Non-admin users never trigger the automatic update.
- Patch 872 Unicode-safe MP3 download headers, full titles, multi-select download, robust infinite scroll, compact layout and single-play are retained.
- No new backend endpoint is required beyond the backend already used by Patch 872; if that backend is already deployed, this patch itself is frontend-only.
