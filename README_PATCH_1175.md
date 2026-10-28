# AZOBSS Patch 1175 — Repository Root Packaging Hotfix

Baseline: v1174

## Fix
- Fixes the v1174 ZIP packaging error where the whole website was wrapped inside an `azobss1174/` top-level folder.
- All website/backend files are now stored directly at the ZIP root.
- Restores `index.html`, `Dockerfile`, `package.json`, `deploy-server.js`, `backend/`, `PC-Build/` and all other existing paths to the repository root when processed by AZOBSS Auto Latest ZIP Bot.
- No functional PC Build/live-price/navbar/software-fit changes from v1174 were removed.

## Why the failure happened
The v1174 wrapper folder caused Git to move the entire repository into `azobss1174/`. GitHub Pages then had no root `index.html` (404), while Render could no longer find the root Docker build files and failed immediately.

## Verification
- package.json version: 1.0.1175
- `node --check deploy-server.js`: PASS
- `node --check lib/azobss-lot-cad-converter.js`: PASS
- `PC-Build/pc-build-data.json`: valid JSON
- ZIP root contains `index.html`, `Dockerfile`, `package.json`, `backend/`, `PC-Build/` directly.
- ZIP root does NOT contain an `azobss1175/` wrapper directory.
