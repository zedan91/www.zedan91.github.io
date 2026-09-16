# AZOBSS Patch 1137 — Admin Purchase Records Download Reset

- Purchase Records Users shows the real per-item download usage, e.g. `1/5`.
- Administrator gets `Reset 0/5` beside each paid purchase row.
- Reset is backend-authorized, resets all counter aliases, and renews the 7-day window.
- Existing purchase record ID and download/source link are preserved, so old customer links remain valid after reset.
- Previous request idempotency key is cleared so the first post-reset download counts correctly.
- Legacy record identity fallback is included for older purchase rows.
- Normal customer policy remains 5 downloads / 7 days.

Deploy frontend + main Render backend. Firebase Rules and Lucky Draw backend are unchanged.
