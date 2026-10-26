# AZOBSS v1432 — PC Retailer Spec-Based Usage

Baseline: v1431.

## Perubahan
- Semua 121 rekod katalog dalaman daripada 15 kedai kini mempunyai `bestFor` berdasarkan spesifikasi sebenar/snapshot rekod, bukan lagi teks generik `Banding harga antara kedai` dan `Semak stok / konfigurasi sebelum tempahan`.
- `softwareFit` retailer turut diisi mengikut kelas CPU/GPU/RAM dan jenis workstation/gaming.
- Integrated GPU difokuskan pada office, browsing, POS, AutoCAD 2D ringan dan creative ringan.
- RTX 3050 / kelas entry diberi kegunaan 1080p entry, AutoCAD 2D/SketchUp dan editing ringan.
- RTX 5050/5060/5060 Ti/RX 9060 XT diberi kegunaan AutoCAD 2D/3D, Revit/Civil 3D kecil-sederhana, gaming 1080p/1440p dan rendering sederhana.
- RTX 5070 ke atas / GPU workstation diberi kegunaan BIM/CAD 3D besar, rendering, 4K, AI/GPU compute mengikut tahap GPU.
- Rekod dengan GPU configurable atau custom tidak dipaksa kepada prestasi palsu: kegunaan dinyatakan `ikut GPU/RAM yang dipilih`.
- Jika konfigurasi asas cuma 8GB RAM tetapi GPU kelas sederhana/tinggi, cadangan upgrade 16GB/32GB dipaparkan.
- Query cache katalog retailer dinaikkan ke `v=1432` supaya browser/CDN mengambil JSON baharu.

Tiada harga retailer diubah dalam patch ini.
