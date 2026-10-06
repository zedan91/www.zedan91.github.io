# AZOBSS Patch 1167 — Admin PA/BM Item Detail + Qty Fix

Baseline: 1.0.1166
Version: 1.0.1167

## Admin > Sales & Receipts
PA/BM website transactions now show the actual purchased document reference and state instead of only a generic unit label.

Examples:
- Pelan Akui PA34334 WPKL
- Benchmark BM B 2342 Selangor
- GPS GP90 WPKL
- Syit Piawai (Gambar) 4B Selangor
- Lot Kadaster Berdigit Selangor

A new `Qty` column is placed immediately after `Items / Payment`.

## Invoice / Receipt
PA/BM order items are reconstructed from the stored `paBmItems` cart records. Each PDF/print item now carries its actual `qty`, so the existing Qty column in Invoice / Receipt displays the correct quantity.

For multi-item PA/BM orders, the premium-order copy is used to enrich the deduplicated purchase-log row so the full order item list and full order amount are retained.
