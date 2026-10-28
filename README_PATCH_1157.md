# AZOBSS Patch 1157 — Maintenance Status Clarity

Baseline: v1156.

## Changes
- Maintenance API now returns severity `ok` whenever an issue count is 0, so zero-count checks are no longer labelled HIGH/MEDIUM/LOW.
- Maintenance Issues UI renders zero-count checks as a green `✅ ... — OK` status.
- Firestore orders that are not present in the local Render JSON cache are now classified as `INFO`, not a fault.
- That cache condition is labelled `Local cache incomplete — Firestore data safe` and explains that Firestore remains authoritative.
- The summary card `Need Local Restore` is renamed to `Local Cache Gap (Safe)`.
- Existing repair actions, Firestore data, retention cleanup and all v1156 admin navigation/sub-tabs are preserved.
