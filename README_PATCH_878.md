# AZOBSS Patch 878 — Sound Effects adjustable zoom + account sync

- Adds compact `− / 100% / +` controls to `/Sound-Effects/`.
- Zoom range: 60% to 140% in 10% steps. Clicking the percentage resets to 100%.
- The whole Sound Effects workspace scales together (hero, controls, cards, player, text and action buttons), while the global fixed AZOBSS navigation remains unchanged.
- Guest zoom preference is stored only in browser localStorage (`azobssSoundUiZoomV878`).
- Logged-in users sync `uiZoomPercent` into the existing low-quota document: `users/{usernameKey}/soundFavorites/state`.
- No extra Firestore document and no realtime listener are added. The existing favorites document read is reused on login; zoom writes are debounced by 500 ms.
- Existing Patch 875 Firestore rule already covers this same document path, so no new Firestore Rules publication is required if Patch 875 rules are already published.
- All previous Sound Effects features remain intact, including Favorites, Recent/admin auto-update, deep links, full titles, multi-download, duration metadata and remaining-time countdown.
