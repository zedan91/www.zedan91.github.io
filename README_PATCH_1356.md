# AZOBSS Patch 1356 — Commission Self-Purchase Guard + Modal Scroll Fix

- Blocks automatic commission when the commission recipient is the same account as the buyer (username, UID, or email match).
- Staff/Manager can still earn commission from purchases made by other customers through valid ownership/referral rules.
- Fixes Admin > Commission Manager > Commission Details modal:
  - modal body scrolls independently,
  - background/dashboard scrolling is locked while open,
  - Close/backdrop clicks remain interactive,
  - Escape closes the detail modal,
  - modal starts at the top each time it opens.
- Shared Payment Details modal receives the same scroll-lock improvement.
- Version: 1.0.1356.
