# AZOBSS v1215 — AZDM Serial Visibility, Unique Edit & Delete Customer

This patch continues v1214 and completes the requested AZDM license-management controls.

## Added
- Admin > Software Key > AZDM now shows the full Serial Key when the Worker has an encrypted copy.
- A Copy button is available beside visible serials.
- Edit License now supports changing the Serial Key.
- A changed serial is validated by the Worker, must use the AZDM format, must differ from the current key, and must not match any other license.
- A database UNIQUE index on `licenses.serial_hash` provides server/database-level duplicate protection.
- Changing a serial clears the old PC binding and activation token so the old serial can no longer renew online.
- Delete Customer is added to each license row. Deletion requires typing the exact customer name before the Worker deletes the license.
- New/admin-issued and paid-order serials are stored as AES-GCM ciphertext in `licenses.serial_cipher`; plaintext serials are only decrypted for authenticated admin-list responses.
- The Worker self-migrates `licenses` by adding `serial_cipher` and the unique serial-hash index. An optional SQL migration is included for manual D1 use.

## Existing/legacy serials
Before v1215 the license database stored only `serial_hash`, so the original plaintext serial cannot be reconstructed. Existing rows therefore show `Legacy — key lama tidak dapat dipulihkan`. Open Edit and enter a new unique serial once; after that the new serial is encrypted and can be displayed in the admin list.

## Security
- `serial_cipher` is never returned to the browser.
- Serial plaintext is returned only through the existing authenticated admin route.
- The serial vault encryption key is deterministically derived from the existing `LICENSE_SIGNING_KEY` with domain separation; no new Cloudflare secret is required.
- Delete is protected by admin authentication plus exact customer-name confirmation.

## Deployment
1. Deploy the website/Render package normally.
2. In Cloudflare Worker `azdm-license`, replace the current Worker code with `AZOBSS-Developer-Files/AZDM-Cloudflare-Worker-v1215.js` and Deploy.
3. No manual D1 migration is required; the Worker performs it automatically. If preferred, run `AZDM-D1-MIGRATION-v1215.sql` once before deployment.

Package version: `1.0.1215`.
