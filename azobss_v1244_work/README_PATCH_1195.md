# AZOBSS v1195 — Staff Payout Always Open + Pagination

Baseline: v1194.

## Staff > My Payout
- Payout Profile is now permanently expanded. There is no minimize/collapse control, so staff/manager can immediately see the payout form and QR upload area.
- Permintaan Payout is also permanently expanded.
- Rekod Komisen is permanently expanded.
- Payout Request history now uses compact pagination: 5 records per page.
- Commission history now uses compact pagination: 8 records per page.
- Pager shows Previous/Next, compact page numbers, visible record range, total records and current page.
- Pagination is hidden automatically when only one page exists.
- Changing commission status filter returns the commission list to page 1.
- Refresh Requests returns payout request history to page 1 so the latest request is visible.

## Version
- package.json: 1.0.1195
