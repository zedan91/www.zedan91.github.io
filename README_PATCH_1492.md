# AZOBSS v1492 — AZOBSSTV Retirement

- Removed AZOBSSTV from More navigation and Admin navigation.
- Removed the active AZOBSSTV frontend, media catalogs, backend handler, and admin workspace.
- Legacy `/AZOBSSTV/` is a non-streaming retirement notice that clears old AZOBSSTV service-worker caches.
- Legacy `/api/azobsstv/*` returns HTTP 410 Gone.
- No other AZOBSS products/services were intentionally changed.
