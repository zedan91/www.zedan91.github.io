# AZOBSS Patch 1245 — Staff Ukur Tanah Navbar Visibility Fix

## Fixed
- `Ukur Tanah` no longer disappears when a normal User is promoted to **Staff**.
- Staff and Semi-admin keep the public `Ukur Tanah` navbar tab.
- Existing private `PA / BM` visibility and Admin access rules remain unchanged.
- Both the pre-paint navbar state and the live `azobss-global-auth.js` sync now use the same visibility rule, preventing the button from disappearing after auth/profile sync.
- `azobss-global-auth.js` cache version bumped to `v=1245`.

Package version: `1.0.1245`
