# AZOBSS Patch 875 — Low-Quota Sound Favorites

Baseline: `(874)-AZOBSS-SOUND-EFFECTS-PER-SOUND-DEEP-LINK-FIX_20260809.zip`

## Added
- Small heart button (`♡` / `♥`) on every Sound Effects card.
- New `♥ Favorites` filter.
- Favorites work for base catalog, Recently Added sounds, and custom sounds.
- Direct per-sound links from Patch 874 keep the correct favorite state.

## Storage strategy
- Guest: favorites are stored only in browser `localStorage`; no Firestore read/write is used.
- Logged-in user: favorites are stored in exactly one Firestore state document:
  - `users/{usernameKey}/soundFavorites/state`
- Document fields: `soundIds`, `usernameKey`, `uid`, `updatedAt`.
- The page performs a one-time `getDoc()` when the authenticated user enters Sound Effects.
- No `onSnapshot` / realtime favorites listener is used.
- Each heart toggle uses `arrayUnion()` or `arrayRemove()` on the same state document.
- A per-user local cache gives immediate UI while the one Firestore read completes.
- Guest favorites are merged into the logged-in account once on login/page entry, then the guest list is cleared after successful cloud seed.

## Firestore rules
Patch 875 adds the required rule to:
- `AZOBSS-Developer-Files/FIREBASE-RULES-AZOBSS-PRODUCTION-LOCKED.txt`
- `AZOBSS-Developer-Files/FIREBASE-RULES-MERGED-FOOD-ORDERS-671-ACCESS-CONTROL.txt`

A standalone snippet is also included:
- `AZOBSS-Developer-Files/FIREBASE-RULES-PATCH-875-SOUND-FAVORITES.txt`

Publish the updated Firestore rules before testing logged-in cross-device sync. Guest favorites work without a rules change.

## Preserved
- Admin automatic Recent update on page entry.
- Recent category repair.
- 7,210 base catalog + server Recent catalog.
- Full titles.
- Unicode-safe MP3 download backend.
- Per-sound deep links.
- Multi-select/bulk MP3 download.
- Robust infinite scrolling.
- Single-play audio behavior.
