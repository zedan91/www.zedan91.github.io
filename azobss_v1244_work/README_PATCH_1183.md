# AZOBSS v1183 — Expanded Desktop / Workstation PC Lineup

Baseline: v1182.

## Kajian rujukan
- Mengambil struktur katalog desktop semasa: Package PC, Workstation PC dan Office PC.
- Menambah filter ala katalog sebenar: CPU platform, resolution/class, GPU vendor, GPU model, price range dan sorting.
- Menambah lebih banyak build siap daripada Office sampai RTX 5090 serta Workstation/AI.
- Rujukan harga market disimpan sebagai sumber admin sahaja pada UI, sementara pelanggan melihat Harga AZOBSS selepas markup.

## PC Build
- Ready-build count: 18.
- New Office: AMD Standard, Intel Standard.
- New entry/value gaming: RTX 3050, RX 9050, RTX 5060 value.
- New creator/high-end: RTX 5060 Ti 16GB, RTX 5070 Ti 16GB, RTX 5090 32GB.
- New Workstation/AI: RTX 5060 Ti, RTX 5070 Ti, RTX PRO 4000 Blackwell 24GB, RTX PRO 4500 Blackwell 32GB.
- Existing 6 AZOBSS builds remain.

## Filters
- Semua PC / Office / Package-Gaming / Workstation-AI.
- AMD / Intel CPU.
- Office / 1080p / 1440p / 4K / Workstation / AI.
- NVIDIA / AMD Radeon / Integrated.
- Dynamic GPU model filter.
- Expanded budget up to RM35,000.
- Reset Filter button.

## Live price
- Production `deploy-server.js` and parity `backend/server.js` now include live reference sources for all 18 cards.
- Existing 5-minute cache, fallback price, tiered markup and deterministic varied price endings remain.
- Price source / market cost / markup remain visible only to Administrator in the rendered UI.

## Build Sendiri
- Full 29-category v1182 builder is preserved.
- Preset mapper now also maps `Case` and `Cooler`, improving ready-build -> full-builder handoff.
