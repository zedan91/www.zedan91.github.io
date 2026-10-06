# Patch 829 — Mandatory Floor / Unit Number

Baseline: patch 828.

- `Floor or unit number` is now mandatory on `/Tempah-Servis-IT/`.
- The field shows a required marker and uses native browser required validation.
- Backend validation also rejects a service booking when `floorUnit` is empty, so the requirement cannot be bypassed by direct API submission.
- All patch 828 WhatsApp routing, read-only address, booking/invoice and admin features are preserved.
