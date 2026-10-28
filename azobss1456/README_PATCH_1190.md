# AZOBSS v1190 — Staff Sales View Permission & Scoped Sales Fix

## Problem fixed
- Staff accounts could enter `/staff/` successfully but clicking **Sales View** displayed `No permission`.
- Root cause: older/normal Staff profiles can have `role: staff` without an explicit `permissions.canViewPayments=true`, while Sales View required that individual permission flag.

## v1190 fixes
- Valid `Staff`, `Manager`, `semiAdmin`, `seller` and `editor` dashboard roles can now open **Sales View** even when the legacy `canViewPayments` flag is missing.
- This does **not** grant access to other staff sales. Sales data remains scoped to the currently authenticated account.
- Sales View now uses protected `commissionRecords` via backend API first. The Firebase ID token is verified server-side and only commission records belonging to the logged-in identity are returned.
- Browser Firestore `purchaseLogs` reads are now only a legacy fallback when no authoritative commission sale record exists.
- Removed the Sales View `alert('No permission')` flow for valid Staff/Manager accounts and replaced failures with an inline friendly status message.
- Staff Sales View now shows the actual sale amount, actual commission amount, actual commission rate, payout status and order ID instead of hard-coded `70% / 30%` calculations.
- `Owner Direct Sale` and `Owner Split Sale` are shown separately.
- Sales are deduplicated by Order ID / Bill Code so the dashboard does not count the same sale more than once.
- Staff overview **Sales Sah** now follows the same authoritative commission source, keeping Overview and Sales View consistent.
- Approved commission is no longer incorrectly counted as Paid in the Staff overview. Only `payoutStatus=paid` enters the Paid total.
- Voided and rejected commission records are excluded from payable totals.
- Added `Manager` to the Staff Dashboard role allow-list explicitly.

## Security
- Staff/Manager Sales View remains self-only.
- PA/BM purchases remain excluded from Staff Software/CAD commission sales.
- Admin-wide sales access is unchanged.

Production backend remains `node deploy-server.js`.
