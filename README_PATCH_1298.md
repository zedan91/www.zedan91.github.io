# AZOBSS v1298 — Administrator-only website version label

- Adds a tiny website version label (`v1298`) at the top-left just below the visible navbar.
- The label is hidden by default and is shown only when the authenticated page role is Administrator/admin.
- User, Staff and Manager views do not show the version label.
- The label is fixed/overlay-only, so it does not push or move page content.
- Global auth cache-buster updated to `v=1298` on pages that load the shared auth module.
