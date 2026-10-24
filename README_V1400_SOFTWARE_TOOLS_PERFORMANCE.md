# v1400 — Software Tools long-session performance

The live Software Tools page was measured read-only in the browser. During a
42.30-second idle sample it consumed 42.25 seconds of main-thread task time,
including 37.34 seconds of JavaScript, with 1,463 layouts and 1,468 style
recalculations. A CPU profile identified the owner-label upsert and statistics
cache reads/querySelectorAll as hot paths. Listener count stayed approximately
constant; the evidence establishes repeated DOM work and allocation churn, not
a proven permanently retained-memory leak.

## Root cause and fix

- Owner labels and commission icons replaced their own HTML/text on every pass.
  Their subtree observer saw those replacements and scheduled the same renderer
  again. Writes now occur only when displayed values really change. Observer
  callbacks are coalesced and react to new cards, owner/commission metadata and
  promo changes; auth/storage/focus events still update owner labels.
- Bookmark and cart renderers rebuilt identical SVG/icon children. Their broad
  observers then triggered another pass. Existing icons are now reused; bookmark
  state/labels and cart state still change normally.
- A legacy free-download cleaner replaced identical Download Now markup each
  time its observer ran. It now normalizes only a changed structure/text.
- The stats observer reacted to every nested icon/text replacement, scanning all
  cards and parsing the complete statistics cache for each card. It now refreshes
  for cards/footer insertion, coalesces work per animation frame and reads the
  cache once per pass. Explicit remote-stat and like/rating updates are preserved.
- Static admin controls are reused rather than removed/recreated by every poll.

## Apply

The performance-only delta from v1399 is:

1. Software-Tools/index.html
2. assets/js/azobss-live-likes-only.js
3. This README

Publish the two frontend files together. The Software Tools bookmark import now
uses cache tag v1400. Backend settings and payment/serial logic are unchanged;
the full ZIP retains all v1399 SolatTime commerce files and its deployment guide.
No new Render variable is needed for this performance repair. Production has
not been modified by Codex during this task.

## Verification limits

Local before/after fixtures use eight card DOMs captured from the public page and
the actual four implicated inline scripts plus the actual bookmark renderer.
Firebase and account writes are stubbed. The fixture is deliberately smaller
than the full production page: its CPU reduction must not be presented as a
guaranteed full-site percentage. Browser checks cover idle metrics, repeat renders,
card insertion, role/owner visibility, commission changes, bookmark state and
statistics updates. The existing commerce/backend regression suite is preserved.

Raw CPU profile, live sample, fixture results and browser QA records are kept in
the canonical project's Verification folder, outside this customer website ZIP.
