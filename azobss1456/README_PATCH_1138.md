# AZOBSS Patch 1138 — Admin Test Download (Customer POV)

Baseline: `(1137)-AZOBSS-ADMIN-PURCHASE-RECORDS-DOWNLOAD-RESET-LINK-PRESERVE-FIX_20260916.zip`

- Adds a green `Test ↓` button beside each paid record in `Purchase Records Users`.
- The button uses the exact same customer-controlled download flow (`azobssClientControlledDownload`) and `/api/pa-bm-download` route.
- It respects the same 5-download quota and 7-day expiry.
- A successful test consumes one real download slot, exactly like the customer POV.
- The existing `Reset 0/5` button can immediately restore the quota after testing.
- Expired/exhausted/unavailable rows show disabled `Test 🔒`.
- The test button is admin/owner-only and never appears to normal customers.
- No backend endpoint changes are required in v1138; the v1137 backend behavior is reused.

Deploy frontend.
