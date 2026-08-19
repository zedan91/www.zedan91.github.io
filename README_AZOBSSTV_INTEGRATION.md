# AZOBSSTV v1.0.965

This AZOBSSTV build is integrated into the AZOBSS website baseline.

Public: `/AZOBSSTV/`
Admin: `/admin/AZOBSSTV/`
Backend health: `/api/azobsstv/health`

The backend uses the existing AZOBSS native HTTP server and Firebase Admin stack. No Express dependency is required.

The bundled `azobsstv-backend/data/free.m3u` is empty by design. Configure authorized playlist/EPG URLs from AZOBSSTV Admin or populate the bundled fallback files.

If Firebase Admin is unavailable for the standalone AZOBSSTV admin page, set `AZOBSSTV_ADMIN_TOKEN` in Render and enter the same token in the optional fallback field. Prefer the existing Firebase admin session in normal operation.

`AZOBSSTV_ALLOW_ALL_PROXY=1` is intentionally OFF by default. Keep it unset unless you explicitly want the playlist/EPG fetch helper to follow arbitrary domains while `allow_all_domains=true`. Stream media is never proxied by this module.
