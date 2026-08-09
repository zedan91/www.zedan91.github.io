# Patch 850 — Tech Vault General File Upload

- `/tech/` no longer limits uploads to `.bat`.
- Tech Vault now accepts any normal file name/type, while keeping filename sanitization and the existing backend size limit.
- UI wording changed from BAT-only to generic files/tools.
- File cards display the actual extension (BAT, EXE, ZIP, PDF, etc.).
- Render backend `deploy-server.js` signs/stores arbitrary private Tech Vault files using `application/octet-stream` as fallback MIME type.
- Cloudflare R2 Worker source in `AZOBSS-Developer-Files/AZOBSS-Cloudflare-R2-Worker-Patch-735.js` was updated to remove the BAT-only restriction. Deploy/update the Worker code for non-BAT uploads to work against the live R2 upload endpoint.
- Existing password protection, private R2 storage, share links, bulk delete, search/sort and download behavior remain unchanged.
