# AZOBSS PATCH 1369 — AZOBSSTV Admin Guard Visibility Fix

Baseline: v1368.

Fixes `/admin/AZOBSSTV/` blank page after the canonical Admin shell migration.

Root cause: v1368 copied the canonical Admin access-guard CSS (`body:not(.az-admin-access-ok) .admin-shell { display:none }`) but did not copy the matching Firebase admin access-guard module that verifies the admin and adds `az-admin-access-ok`. The navbar could render while the entire AZOBSSTV admin shell stayed hidden.

Changes:
- Restored the exact canonical `az-admin-access-guard` module from `/admin/index.html`.
- Admin session is verified the same way as the main Admin Dashboard before the AZOBSSTV shell is shown.
- Unauthorized/not logged-in users get the normal Admin Only message instead of a blank page.
- AZOBSSTV backend/API endpoints, tab controller, config, notifications, devices and heartbeat logic are unchanged.

Expected result: logged-in owner/admin sees the sidebar + AZOBSSTV tab interface after the short Firebase access check.
