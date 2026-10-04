# AZOBSS v1086 — Makan Malaysia Halal-Only

Baseline: v1085.

## Changes
- `/Makan-Malaysia/` is now halal-only.
- Removed ambiguous/non-halal curated entries (including Yut Kee, Nam Heong, Capitol Satay Celup, Choon Hui, Chong Choon, Mawilla and other unclear premises).
- `places.json` contains only records with `halalOnly: true`.
- Runtime also filters to `halalOnly === true` as a second safety layer.
- Added halal status badge on every card.
- Added clearer halal-only hero copy and JAKIM verification notice/link.
- Added halal East Malaysia replacements: Kak Nong (Sabah) and King Laksa Sarawak ICOM Square (Sarawak).
- Existing v1085 AZOBSSTV performance and Google Maps fallback fixes remain unchanged.
