# AZOBSS v1379 — Ebook Tutorial Click/Close Fix

- Fix Firefox/desktop tutorial modal becoming impossible to close.
- Tutorial controls are now direct-bound, independent from the global delegated click handler.
- X button, bottom confirmation button, backdrop click and Escape key all close the tutorial.
- Global delegated click target is normalized for Firefox text-node targets.
- Keeps v1378 tutorial design and all v1377/v1376 Ebook access/performance behavior.
