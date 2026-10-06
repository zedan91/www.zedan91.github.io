# AZOBSS Patch 1066 — Logout / Guest Navbar State Authority Fix

Fixes the inconsistent navbar seen after logout.

## Fixed
- Pre-paint auth styles now stop applying after `azobss-global-auth.js` has synchronized.
- Logout immediately switches navbar pre-state to guest.
- Guest navbar explicitly shows **Register / Login**.
- Guest navbar explicitly hides account/avatar/bookmark/cart/notification/chat user tools.
- Admin and Staff dashboard buttons cannot remain visible for a guest.
- WhatsApp quick action is restored for guests and normal users.
- The public survey tab is normalized to **Ukur Tanah** on every page, including AZOBSSTV.
- Existing v1065 zero-layout-shift fix remains.
- Existing v1064 Manual Invoice registered-customer autocomplete remains.

Package version: `1.0.1066`
