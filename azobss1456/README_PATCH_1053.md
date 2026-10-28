# AZOBSS Patch 1053 — Stickybar Static First-Paint DOM Fix

Baseline: v1050. v1051 and v1052 are cancelled and not used.

## Scope
- Pre-render the exact existing final `Ukur Tanah`, `Repair PC`, and `More` navigation markup in all 25 stickybar pages.
- Stop `azobss-more-nav.js` from inserting/removing/replacing those direct navbar items after DOMContentLoaded.
- Keep the existing v1050 stickybar CSS, dimensions, colors, auth logic, role logic, dropdown styling, and backend unchanged.
- Keep a legacy JS fallback for pages that do not contain static markup.

## Why
In v1050 the first HTML paint contains `Bina Website` + `Mini Web Tools`, while `Repair PC` and `Ukur Tanah` are added later. JavaScript then removes/replaces items to create `Repair PC` + `More`, causing visible horizontal layout shift on every full-page navigation. v1053 renders the final layout directly in HTML so that conversion no longer occurs after paint.

## Deploy
Website only. No Render/backend redeploy required.
