# AZOBSS Patch 983 — AZOBSSTV Text Schedule + Single Audio Fix

- Removes both v982 Mana-Mana guide mirror iframes. Only the main official player iframe remains, preventing duplicate audio.
- Restores real text for NOW PLAYING and Today's Schedule.
- Backend schedule order: rendered public Mana-Mana DOM using headless Chromium (media blocked + audio muted) -> Revlet guide API -> raw HTML/Next.js parser.
- Adds `puppeteer-core@25.0.4`; Docker installs Debian `chromium` and `fonts-liberation`.
- Schedule cache remains 60 seconds.
- `render.yaml` now explicitly watches `azobsstv-backend/**`.
- Existing player auto-focus, extend/restore, channel rail, icons and other AZOBSS systems remain unchanged.

Package version: 1.0.983
