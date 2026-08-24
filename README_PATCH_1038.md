# AZOBSS v1038 — Free Promo Secure Download Wake + Retry Fix

- Fixes Software Tools Free Promo Download getting stuck indefinitely on the `Preparing secure download...` tab when the Render backend is sleeping or stalls during cold start.
- The frontend now sends a non-blocking `/health` wake request as soon as an R2 promo download begins.
- Secure-link generation now uses an AbortController timeout and automatic retry: first attempt up to 20 seconds, second attempt up to 30 seconds.
- The preparation tab updates its status to show when the secure server is being retried instead of appearing frozen forever.
- If both attempts fail, the preparation tab closes and the user receives a clear retry message instead of waiting indefinitely.
- Failed secure-link generation rolls back the Firestore promo claim so a temporary Render/network failure does not permanently consume one free promo unit.
- Successful flow remains unchanged: verified promo claim -> backend signed R2 gate -> Cloudflare `AZOBSS Download Ready` page -> `Start Download`.
- ToyyibPay remains unchanged and Billplz remains on hold. No payment gateway migration is included in this patch.
- Frontend-only fix; Render redeploy is not required.
- Package version: 1.0.1038.
