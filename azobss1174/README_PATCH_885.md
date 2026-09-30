# AZOBSS Patch 885 — Sound Effects More Dropdown Active Highlight

- Baseline: 884.
- Fixes the remaining visual issue on `/Sound-Effects/`: the top-level **More** trigger was green, but the **Sound Effects** item inside the open dropdown could still look inactive.
- Adds a robust active style for dropdown links using `aria-current`, `is-active`, `is-current`, or `market-nav-active`.
- The active dropdown row now uses the same solid AZOBSS green treatment as other active navbar buttons.
- Bumps shared More-nav CSS/JS cache references to `v=885`.
- No backend/Render redeploy required.
