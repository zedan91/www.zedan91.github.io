# AZOBSS v1141 — Download/Test Spinner Visible Every Click Fix

Baseline: `(1140)-AZOBSS-DOWNLOAD-BACKEND-WAKE-SPINNER-FIX_20260916.zip`

- v1140 waited 350 ms before showing the overlay, so a warm backend could finish the health check before the spinner appeared.
- v1141 shows the overlay immediately on every controlled download, including Administrator `Test ↓`.
- The clicked button also gets a small rotating spinner.
- Overlay stays visible for at least about 650 ms to avoid an invisible flash.
- Warm server: `Menyediakan muat turun...` -> `Server sedia` -> download.
- Cold Render server: after about 1 second the message changes to `Server sedang dibangunkan...` and shows wait time.
- Health check remains quota-free; exact-once counter and reset flow are unchanged.
- Frontend only; hard refresh after deploy.
