# AZOBSS v1464 — Upgrade Parts Detailed Hardware & Pricing

Baseline: v1463.

## Perubahan utama
- Upgrade-Parts kini membezakan RAM DDR1, DDR2, DDR3/DDR3L, DDR4 dan DDR5, termasuk DIMM/SO-DIMM, kapasiti dan speed biasa.
- Storage dipecahkan kepada 2.5-inch SATA SSD, M.2 SATA SSD, NVMe PCIe Gen3/Gen4/Gen5 dan HDD.
- GPU dipecahkan kepada Entry, Mainstream, Performance dan High-end dengan nota PSU/casing/connector.
- PSU dipecahkan mengikut wattage dan efficiency class.
- Tambah kategori Cooling/Fan dan Wi-Fi/Bluetooth.
- Bateri dan adapter diperincikan mengikut jenis/wattage.
- Kalkulator anggaran menggunakan pilihan teknikal yang sama seperti jadual.
- Backend live-price engine diperluas kepada semua pilihan terperinci dan masih hanya menghantar julat agregat kepada frontend.
- Legacy RAM (DDR1/DDR2) ditanda sebagai legacy/semak stok kerana availability tidak konsisten.
- Auto-sync live/fallback dikekalkan.
- Global version badge/cache bust dinaikkan ke v1464.

## Tidak diubah
- Flow tempahan, auth, checkout/payment, Sales & Receipts, PA/BM, Liyabudun, Software Tools Pin Order dan fungsi lain.
- Struktur ZIP kekal flat/root-ready untuk Render Root Directory `backend`.
