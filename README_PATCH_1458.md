# AZOBSS v1458 — PA/BM Download Button Return-to-Normal Fix

## Fix
- Fixes PA/BM / Lot Kadaster download buttons that could remain grey/locked after the file was already handed to the browser.
- Root cause: ZIP purchase-record refresh can occur about 4.2 seconds after handoff, later than the previous 1.8-second cleanup window.
- Cleanup window now covers 0–10 seconds while still refusing to unlock a newer active download.
- Added an idle-only MutationObserver self-heal for `#userPaPurchaseList`. Whenever a late rerender replaces buttons and there is no active download owner, stale `data-busy`, `data-preparing`, `data-download-locked`, `aria-busy`, `aria-disabled`, spinner classes/nodes, pointer-events, and stale labels are normalized immediately.
- Self-heal also runs on page show, focus, and tab visibility return.
- Legitimate `is-locked` states (expired / limit reached / pending payment) are preserved.
- Existing 3.5-second anti-spam cooldown and exact-once quota logic are unchanged.

## Preserved
- v1457 flat repo-root deploy packaging.
- v1456 SSM on Quotation / Invoice / Receipt.
- v1455 website SSM footer.
- Liyabudun 1.0.51, Software Tools Pin Order, PA/BM 5 downloads / 7 days, admin Reset 0/5.
