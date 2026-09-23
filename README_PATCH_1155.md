# AZOBSS Patch 1155 — Firefox PA/BM Download Compatibility

Date: 2026-09-24

- Fixes Firefox PA/BM download buttons that could spin indefinitely while Chrome/Edge worked.
- `/health` is now a best-effort wake hint only. Firefox CORS/ETP/network failures fail open immediately to the real download endpoint instead of blocking for up to four minutes.
- Health checks use a short 3.5 s request timeout and a 9 s overall advisory window.
- Lot readiness requests use a 15 s per-request timeout.
- Final controlled download requests use a 30 s timeout with bounded retry inside the existing download deadline.
- Native attachment delivery no longer depends on a cross-origin hidden iframe. AZOBSS backend attachments are triggered with a native anchor so Firefox is not blocked by `X-Frame-Options`/iframe behavior.
- Backend CORS now accepts both `azobss.com` and `www.azobss.com` through wildcard API CORS (no cross-site cookies are used by this flow).
- Backend exposes `Content-Disposition` and AZOBSS fallback headers so Firefox can read the same metadata as Chromium browsers.
- ZIP + DXF layout from v1154 is preserved. DWG remains hidden.
- Stale-job/direct-ZIP recovery from v1152/v1153 remains preserved.
- `/PA-BM/` cache-busters raised to `v=1155`.
- Package version: `1.0.1155`.
