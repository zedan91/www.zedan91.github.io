# AZOBSS v1397 — SolatTime in Software Key / Digital Access

Baseline: user-supplied full website v1396. Existing package.json/global version
badge values are preserved; the edited/new admin JavaScript uses cache tag 1397.

## What changed

- Tabs are ordered **AZDM → SolatTime → SurveyCAD → Ebook Access**, with the
  actual SolatTime app logo. Arrow keys/Home/End work across all four tabs.
- SolatTime has its own licence panel, serial issuance, list (25 per page),
  search on the current page, block/restore confirmation and legacy-key import.
- New serials appear once in a dialog, with explicit Copy and Save .txt buttons.
  The existing SolatTime service stores serial hashes, so the list cannot recover
  the original serial. No serials or admin tokens are put in browser storage.
- The panel describes the actual SolatTime model: a 30-day trial started in the
  app, perpetual paid offline access, and explicit app-based PC transfers.
- Mobile tabs use two columns. Large licence tables scroll within their panel.
- Existing AZDM/SurveyCAD/Ebook handlers and their data are preserved.

## Deployment setup (required for the embedded licence actions)

1. Deploy the complete website source, including **deploy-server.js**, **lib/**
   and the new frontend files. The backend entrypoint remains node deploy-server.js.
2. In the existing **azobss-backend Render service**, add the **secret environment
   variable SOLATTIME_ADMIN_TOKEN**. Its value must match the existing **ADMIN_TOKEN
   of the SolatTime Cloudflare Worker**, not the AZDM token. This is an existing
   owner credential; do not rotate it, put it in HTML/JavaScript, or commit it.
3. Redeploy the Render backend after setting the variable. render.yaml declares
   the variable with sync:false and intentionally contains no value.
4. Sign in with an existing authorized AZOBSS admin account, open Keys & Digital
   Access, and select SolatTime. Its backend reuses the existing verified Firebase
   identity and server-side admin allow-list. A browser role/name cannot grant access.

The browser calls /api/solattime/admin/{list,issue,import-legacy,block,restore}
on the existing azobss-backend.onrender.com service. The server alone authenticates
to https://solattime-license.zedan9107.workers.dev/admin/ using its environment
credential. The Worker is the existing SolatTime service; no new Worker/D1 is needed.

Without the secret/backend deployment, the tab still appears and displays a clear
connection message; **Buka panel asal SolatTime** remains available. There is no
fallback to AZDM data or a fake locally generated customer serial.

## Validation

26 targeted tests passed (new SolatTime admin checks + AZDM/admin/checkout/package
regressions). Changed JavaScript and the backend entrypoint pass syntax checks.
Browser checks use actual panel HTML/JS/CSS with explicitly labelled local fixture
data: four tabs, keyboard navigation, paging, current-page search, serial dialog,
block/restore, legacy import, missing configuration, session cleanup and mobile.
No production customer licence was issued or changed during testing.

Preview fixtures, owner secrets and local QA screenshots are not in this website
ZIP. The live website has not been deployed by this change.
