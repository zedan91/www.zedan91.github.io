# AZOBSS v1371 — PA/BM Paid Cart Late-Listener / Restore-Race Fix

Date: 21 Oct 2026
Baseline: v1370

## Root cause
`azobss-global-auth.js` loads earlier on `/PA-BM/` than the dedicated storefront module. A fast ToyyibPay verification could dispatch the paid event before `azobss-pabm-storefront.js` attached its listener. The storefront then initialized later and restored the durable pre-payment cart backup, so `Troli Anda` still showed `1 item` even though the payment itself was already Paid.

## Fix
- Global Auth now hard-clears the PA/BM cart immediately inside every verified-Paid path, before any paid event is dispatched.
- Clears canonical username/UID/guest cart aliases, matching payment backups, pending-return keys and the durable server cart draft.
- Writes a short paid-cart marker so a late storefront/auth callback cannot resurrect the just-paid backup.
- Storefront checks that marker **before** `restorePaymentCartBackup()` during init and auth hydration.
- Starting a genuinely new checkout invalidates the old marker, so normal pending-cart recovery still works for the next purchase.
- Admin Test Payment uses the same hard-clear path.

## Expected result
After ToyyibPay or Admin Test Payment is verified Paid, `Troli Anda` immediately becomes `0 item`, total becomes `RM0`, the paid item does not return after auth hydration/page focus, and a new purchase can still use normal cart recovery.
