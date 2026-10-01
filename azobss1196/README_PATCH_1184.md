# AZOBSS Patch 1184 — PC Build Favourite + Share Links

Date: 2026-10-01

## Changes
- Every ready-made PC card now participates in the existing AZOBSS Bookmarks/Favourites system.
- Bookmark icon is injected at the top-right of each PC card. Logged-out users are prompted to sign in; logged-in bookmarks are stored in the existing Firestore `users/{usernameKey}/likes/{itemId}` path.
- Bookmarks page now supports PC Build items and a `PC Builds` filter.
- Each PC card has a `Share` button. Web Share API is used when available; otherwise the unique PC URL is copied.
- Shared URLs use `/PC-Build/?pc=<build-id>` and automatically highlight/scroll to the relevant PC.
- Favourite records store the PC name, current AZOBSS price, image and direct PC share URL.
- Existing v1183 pricing, live refresh, markup, 29-category full builder and workstation/desktop lineup are preserved.
