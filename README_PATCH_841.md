# AZOBSS Patch 841 — Tech Vault Share + Compact Cards + Hero Remove

Date: 2026-08-08
Baseline: (840)-AZOBSS-SERVICE-BOOKINGS-COMPACT-CARD-BULK-DELETE-FIX_20260807_20260807_153032.zip

## Changes
- Removed the large `/tech/` hero section ("Tools ready when site work starts") so the Vault content moves up.
- Added the BAT file count as a compact badge beside `Available tools`.
- Reduced upload card, toolbar, bulk controls, BAT card, icon, metadata, gaps and action button sizes so more tools are visible without scrolling.
- Added a per-file `Share` action.
- Share panel supports native share, Copy Link, WhatsApp, Telegram, Facebook and Email.
- Share action reuses the existing authenticated `/api/tech-vault/download-token` endpoint and creates a secure temporary R2 download URL (current backend response: about 60 minutes).
- Existing Download, upload, search, sort, refresh, select-all and bulk delete behavior is retained.
- Responsive mobile layout remains supported.
