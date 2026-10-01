# AZOBSSTV v1.0.968

This AZOBSSTV build is integrated into the AZOBSS website baseline.

Public: `/AZOBSSTV/`
Admin: `/admin/AZOBSSTV/`
Backend health: `/api/azobsstv/health`

The backend uses the existing AZOBSS native HTTP server and Firebase Admin stack. No Express dependency is required.

The bundled `azobsstv-backend/data/free.m3u` contains the current AZOBSSTV/Mana-Mana catalogue fallback. Custom authorized playlist/EPG URLs can still be configured from AZOBSSTV Admin.

If Firebase Admin is unavailable for the standalone AZOBSSTV admin page, set `AZOBSSTV_ADMIN_TOKEN` in Render and enter the same token in the optional fallback field. Prefer the existing Firebase admin session in normal operation.

`AZOBSSTV_ALLOW_ALL_PROXY=1` remains intentionally OFF by default for arbitrary playlist/EPG fetches. v968 adds a narrow same-origin HLS relay only for a hard-coded public broadcaster CDN host used by the bundled RTM entries; it is not an open proxy and does not add credentials, DRM keys, or spoof authorization headers.
