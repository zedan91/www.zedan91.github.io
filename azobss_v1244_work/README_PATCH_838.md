# Patch 838 — Tempah Servis IT Phone Format & Limit

- Medan No. telefon menerima maksimum 11 digit nombor Malaysia.
- Paparan diformat automatik, contoh `01135600723` menjadi `011-3560 0723`.
- Nombor tersimpan dalam format `+60...` ditukar semula kepada paparan tempatan `0...`.
- Frontend dan backend mengesahkan nombor mudah alih Malaysia 10 atau 11 digit (`01...`).
- Semua fungsi patch 837 dikekalkan.
