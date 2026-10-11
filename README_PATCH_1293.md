# AZOBSS v1293 — Software Tools Long-Session Freeze Fix

This patch targets `/Software-Tools/` only.

## Root cause
The Software Tools admin UI had a 1.5-second long-session timer that called `refreshAdminState()`. That function called `syncStaticAdminButtons()`, and the old implementation removed and recreated the admin action wrapper on every static software card every cycle. Those DOM changes woke several MutationObservers across the same page, creating constant mutation/rescan work while the page was otherwise idle. On an admin account this was especially expensive and could make a long-open tab increasingly sluggish or freeze.

## Fixes
- Static admin action wrappers are now idempotent: create/update only when needed; never destroy/rebuild every refresh.
- 1.5-second admin-role polling replaced by focus/storage/session-resume events plus a 30-second signature-only safety check.
- Admin action observer now watches structural child changes only, not every style/class change.
- Support delete-button scan reduced from 1.2 seconds to 30 seconds; its list MutationObserver remains active.
- Mobile one-card patch no longer watches the whole document and no longer rewrites layout every 1.2 seconds; observation is scoped to software/CAD grids.
- Existing Software Tools features, filters, admin edit/delete/logo controls, stats, payment and sharing remain intact.
