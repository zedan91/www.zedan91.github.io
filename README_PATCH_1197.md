# AZOBSS Patch 1197 — Payout QR Direct Crop Editor

Baseline: v1196 FIX (GitHub Pages root hotfix).

## Changes
- Admin > Commission Manager > Payout Requests > Edit / Tukar QR now opens a direct square crop editor for the current QR.
- Selecting a replacement QR opens the same crop editor before saving.
- Crop editor supports drag/pan, 1x–12x zoom, Reset, and Crop & Guna.
- Staff/Manager > My Payout > Payout Profile gets the same crop flow.
- Added `Crop QR Semasa` so an already-saved QR can be cropped without uploading it again.
- Cropped output is normalized to a 900x900 square with white background and existing payload-size limits.
- v1196 large Admin QR preview/edit features and v1195 always-open/pagination behavior are preserved.
- ZIP root structure remains deploy-safe for GitHub Pages (no outer wrapper folder).
