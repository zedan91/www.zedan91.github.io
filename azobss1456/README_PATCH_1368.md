# AZOBSS v1368 — AZOBSSTV Canonical Admin Shell + Tabs

Baseline: v1367.

Changes only the Admin AZOBSSTV UI shell/layout; existing AZOBSSTV backend/API endpoints remain unchanged.

- `/admin/AZOBSSTV/` now reuses the canonical Admin top navigation markup/styles.
- Sidebar labels/order are aligned with the current `/admin/` shell (including `Keys & Digital Access`; obsolete duplicate `Sales Staff Applications` link removed from this child page).
- AZOBSSTV content is separated into real tabs: Overview, Remote Config, Notifications, Devices, Heartbeat.
- Overview contains Connection + Device Summary.
- Notification composer and notification list are together under Notifications.
- Existing config save, notification send/delete, device list, heartbeat list, Firebase auth and fallback token flows are retained.
- Tab state uses URL hash without backend changes.

No Firebase rules, AZOBSSTV backend routes, API base, or data model changed.
