# AZOBSS Patch v1381 — Configurable Monthly Sales & Profit Graph

Date: 2026-10-22

Baseline: v1380 Admin Analytics Canonical Ledger Reconciliation.

## Changes
- Renamed `Monthly Revenue Trend` to `Monthly Sales & Profit Trend`.
- Default graph shows `Gross Sales` + `Net Profit`.
- Added real SVG graph with:
  - Line Graph / Bar Graph
  - 6 Months / 12 Months / This Year / 24 Months
  - Toggle Gross Sales
  - Toggle Net Profit
  - Optional Total Costs
  - Optional value labels
  - Reset Graph
- Graph settings persist in browser localStorage.
- Hover/touch tooltip on graph points/bars shows exact RM value.
- Summary below graph shows Gross, Costs, Net Profit, Profit Margin and Paid Orders for selected period.
- All graph numbers continue to use the same canonical Sales & Receipts ledger introduced in v1380.
- No old `Paid × RM1` analytics formula is reintroduced.

## Default view
- Range: 6 months
- Chart: Line Graph
- Gross Sales: ON
- Net Profit: ON
- Total Costs: OFF
- Value labels: OFF

## Validation
- 20/20 targeted v1381 static checks passed.
- 32/32 inline JavaScript blocks passed `node --check`.
