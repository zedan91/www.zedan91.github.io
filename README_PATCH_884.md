# AZOBSS Patch 884 — Repair PC + Sound Effects Active Navbar Highlight

- Repair PC now uses the same green active highlight as Software/CAD Tools when `/Tempah-Servis-IT/` is open.
- Sound Effects now makes the `More` trigger green while `/Sound-Effects/` is open, and its dropdown item is also marked active.
- Added a shared direct-navbar active style so active chips are consistent across public pages.
- Bumped shared More-nav CSS/JS cache-busting query to `v=884` on pages that reference them, avoiding stale browser cache.
- No backend change is required.
