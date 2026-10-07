# AZOBSS Patch 1252 — PA/BM Selected State Highlight Fix

## Fix
- Fixes the PA/BM state button grid where clicking a state changed the hidden `<select>` value but the selected button did not stay highlighted.
- Root cause: the early bridge dispatched the `<select>` `change` event first. That synchronous change listener rebuilt the state-button DOM, then the click handler compared the new buttons against the old detached clicked button, clearing `is-active` from every state.
- The active state is now synchronized by `data-state-value === select.value`, before and after the change event.
- `aria-pressed` is kept in sync with `is-active` so the selected state is also explicit for accessibility.
- Selected state receives a clearer blue background, light border and focus ring.
- Applies to all six PA/BM state pickers (PA, BM, Lot Kadaster, GPS, NDCDB C3 and Syit Piawai) without changing their state list or search logic.

## Preserved
- v1251 Add to Cart hard fix.
- v1251 all-state button-grid UI; no dropdown UI restored.
- v1250 failed/cancelled payment stays in cart flow.
- Paid/verified-only Recent Purchases behavior.

## Version
- Package: `1.0.1252`
- PA/BM cache-busters: `v=1252`
