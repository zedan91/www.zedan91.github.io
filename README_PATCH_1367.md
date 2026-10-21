# AZOBSS v1367 — Registered Users: One Email = One Card

- Uses v1366 as the baseline.
- Registered Users now renders **one normal card per email/account group**, not a large grouped container with separate child cards.
- Left side shows the highest rank badge, primary email, and every username under that email with its login method.
- `N username dalam email sama` stays as a small info badge only.
- Middle column merges only **non-default** settings from every username in the email group: PA/BM allowed, active Membership, Tempahan allowed, and special per-category price adjustments. Default settings are visually silent.
- Right side shows the newest concise date and a single **Edit ▾** menu.
- The menu lets Admin choose the exact username to edit. Delete is also username-specific; deleting one username does not automatically delete the other usernames sharing the same email.
- Pagination remains 10 email cards per page; search/sort still work across all usernames inside each email card.
- Frontend/Admin-only patch; backend v1360 remains compatible.
