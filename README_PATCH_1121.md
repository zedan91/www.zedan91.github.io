# AZOBSS Patch 1121 — General Public Wording for PA/BM Map

Package version: `1.0.1121`

## Changes
- User-facing messages on `/PA-BM/` no longer name the upstream map/data provider.
- Replaced provider-specific status/error wording with neutral phrases such as `server peta`, `server data`, `server sumber`, `data kadaster`, or plain `peta`.
- PA historical geometry mismatch now explains the likely real condition clearly: the original PA lots may have been subdivided, amalgamated, renumbered, or otherwise changed after the PA was issued.
- Transient connectivity failures remain separate and are described as temporary server/map connection problems.
- Internal endpoint names, URLs, source identifiers, and technical integration names are unchanged so functionality is preserved.
- Cache-busters for PA/BM map/search scripts updated to `v1121`.

## Deployment
Frontend and backend changed. Push the website and redeploy the Render backend, then hard refresh (`Ctrl+F5`).
