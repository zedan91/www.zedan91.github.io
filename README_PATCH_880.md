# AZOBSS Patch 880 — SurveyCAD Software Key Admin Capture

## Installer
- Survey Tools > SC > `[3] Software Key (Capture + Save Admin)`.
- Opens `C:\SurveyCAD\LISP\SurveyCAD Unlock.exe`.
- Reads **System ID**, **Systemcode**, optional **Onetimecode**, and motherboard/baseboard ID.
- Reuses an existing `R.exe` when available; otherwise downloads `https://files.azobss.com/R.exe`.
- Attempts to fill the first two R.exe input fields with System ID/Systemcode and capture the generated serial key. If R.exe exposes a non-standard UI, clipboard/manual entry is retained as a fallback so the record is not lost.
- Sends the record to `POST /api/software-keys/capture` and keeps a local JSON backup under `%ProgramData%\AZOBSS\SoftwareKeys`.

## Admin Dashboard
- Adds dedicated **🗝️ Software Key** navigation button.
- Search, copy, refresh, CSV export, single delete, and bulk delete.
- Admin reads/deletes use existing Firebase-admin authorization.

## Backend
- Firestore collection: `softwareKeyRecords`.
- Public installer capture endpoint is strict-schema + rate-limited (30 requests/hour/IP) and can only write this dedicated collection. It cannot read/delete records or access other admin data.
- Admin endpoints: `GET /api/admin/software-keys`, `POST /api/admin/software-keys-action`.

## Deploy
Redeploy the Render backend from this ZIP so the capture/admin API routes are active, then publish the website files. No new Render environment variable is required.
