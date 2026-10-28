# AZOBSS v1376 — Ebook Access Cold-Start Resilience

## Fix
- Retains v1375 comfortable one-screen Ebook layout.
- Fixes the `Akses belum dapat disahkan` state caused by the Ebook access request timing out while the Render backend is waking from sleep.
- Starts a lightweight `/api/health` warm-up immediately when the Ebook route initializes.
- Access checks now use a two-stage retry instead of failing after a single ~5 second timeout.
- Concurrent access checks are deduplicated so `init`, `pageshow`, `focus`, and auth-ready events do not hammer a cold backend at the same time.
- Lifetime access cache is fresh for 60 minutes and may be used as same-UID stale-while-revalidate for up to 24 hours.
- If the backend responds normally with `access:false`, the cache is still cleared immediately, so revocation/payment-required decisions remain authoritative.
- If the backend is temporarily unreachable but the same Firebase UID has a valid recent lifetime cache, the generator remains open and revalidates in the background.

## Unchanged
- RM19 one-time/lifetime purchase.
- ToyyibPay checkout and return flow.
- Backend access endpoint and entitlement records.
- v1375 UI sizing/layout.
