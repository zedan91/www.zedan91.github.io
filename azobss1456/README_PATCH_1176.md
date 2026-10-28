# AZOBSS Patch 1176 — PC & IT Services Navbar State & Layout Fix

- Syncs `/PC-IT-Services/` to the Home/PC Build shared navbar structure.
- `Semua PC & IT Services` is the active submenu on the overview page.
- `Upgrade & Parts` becomes active when URL hash is `#upgrade-parts`.
- Active submenu state updates immediately on `hashchange`.
- PC & IT Services parent trigger remains active across overview, PC Build, physical service, upgrade anchor, and online troubleshooting pages.
- Widens the desktop PC & IT dropdown to 390px and improves icon/text vertical alignment.
- Shortens overview/upgrade descriptions to avoid awkward wrapping.
- Adds scroll margin for the Upgrade & Parts section so the shared sticky navbar does not cover it.
- Bumps shared navbar CSS/JS cache busters to `v=1176`.
- Keeps repository files at ZIP root (no wrapper folder), preserving the v1175 repository-root hotfix.

Package version: `1.0.1176`.
