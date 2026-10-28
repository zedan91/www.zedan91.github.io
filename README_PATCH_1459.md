# AZOBSS v1459 — Firefox PA/BM download button restore

Based on v1458.

- Firefox-only BFCache/page restore hard reset for transient PA/BM download owner state.
- Download-control normalizer now removes stale `is-locked`/disabled state only from genuine actionable controls carrying `data-default-label` + `data-download-payload`/`data-download-url`.
- True Expired/Tamat, 5/5 and Pending rows are not unlocked because they are rendered as non-download locked spans.
- Re-runs idle repair on Firefox pageshow/focus/visibility return.
- Chrome/Edge download path is unchanged.
- Global auth cache-bust/badge bumped to v1459.
