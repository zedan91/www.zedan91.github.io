# AZOBSS v1044 — PA/BM Strict Member-Only Direct URL Guard

- `/PA-BM/` is now strict member-only.
- Guest / signed-out visitors are redirected to `/#login`.
- Signed-in accounts without PA/BM permission are redirected to `/`.
- AZOBSS admin remains allowed.
- Direct URL entry no longer bypasses the PA/BM permission check.
- The PA/BM body is hidden during Firebase auth/profile restoration to prevent protected content flashing before the access decision.
- Auth/profile restoration errors fail closed on `/PA-BM/`.
- PA/BM auth-script cache busters updated to `v=1044`.
- No payment, purchase, download, product, pricing, map, or backend API behavior was changed.
