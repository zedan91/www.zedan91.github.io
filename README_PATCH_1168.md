# AZOBSS Patch 1168 — Compact PA/BM Items + Expandable Row

Baseline: 1.0.1167
Version: 1.0.1168

## Admin > Sales & Receipts
PA/BM table labels are compact for easier scanning:
- PA140417 (SGR)
- PA140417 (KTN)
- BM B1524 (SGR)
- GPS GP90 (WPKL)
- Syit 4B (SGR)
- Lot Kadaster (SGR)

The first two PA/BM items are shown. If an order has more items, a `+N more` button expands the same row downward and `Show less` collapses it.

The underlying full item descriptions are unchanged, so Invoice/Receipt descriptions remain detailed. Qty behavior from v1167 is preserved.

Desktop table spacing and column widths are tightened moderately so the Actions column is visible without horizontal sliding on typical admin widths.
