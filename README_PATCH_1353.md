# AZOBSS Patch 1353 — Ebook ToyyibPay Return / Lifetime Unlock Fix

- Fixes the RM19 Ebook Generator ToyyibPay return URL. The backend no longer places `#ebook` inside `billReturnUrl` before ToyyibPay appends `status_id`, `billcode`, `order_id` and `transaction_id`.
- New checkout return URL: `/Software-Tools/?ebook_payment=return`. After ToyyibPay returns, the frontend verifies the bill first and only then normalizes the browser URL to `/Software-Tools/#ebook`.
- Handles old v1351/v1352 bills too, including malformed legacy URLs such as `#ebook&status_id=1&billcode=...`.
- On successful return, the frontend stores the returned bill/order identifiers, asks the authenticated backend to re-check ToyyibPay, grants lifetime entitlement when paid, retries briefly for gateway/callback delay, and then cleans the URL.
- RM19 remains one-time only and account-bound. Login return fix from v1352 remains unchanged.
