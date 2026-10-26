# AZOBSS v1428 — 15 Kedai PC disepadukan ke carian utama

Asas: `(1427) AZOBSS-FULL-WEBSITE-PC-RETAILER-SEARCH_20261026_124058.zip`.

Perubahan pada `/PC-Build/`:

- Direktori 15 kedai tidak lagi menjadi carian admin yang berdiri sendiri pada page utama.
- Main toolbar mendapat dropdown `Semua 15 Kedai` / pilih satu kedai.
- Carian utama CPU/GPU/kegunaan/resolusi/bajet membina kata kunci retailer secara automatik.
- Panel `Carian 15 Kedai PC` kini public dan terus mengikut filter utama di atas.
- Enam kedai dipaparkan dahulu; `Lihat semua` membuka semua 15 kedai.
- Setiap kad build AZOBSS mendapat butang `Banding 15 Kedai` yang mencari spec build tersebut merentas semua kedai yang dikurasi.
- `Reset Filter` turut reset pilihan kedai.
- `/PC-Build/Build-Sendiri/` mengekalkan panel supplier lama sebagai admin-only; hanya cache-bust asset dinaikkan ke v1428.

15 sumber kekal:
ALL IT Hypermarket, Ideal Tech, TMT / Thunder Match, Viewnet, PC Image,
Tech Hypermart, DOTATECH, REXTECH PC, EMARQUE, ILLEGEAR, Brightstar Computer,
NETSTORE, Jayacom, Sri Computers dan C-Zone / Compuzone.

Nota penting: integrasi ini menyepadukan carian dan perbandingan sumber ke satu UI.
Ia tidak menyalin keseluruhan inventori/harga/stok retailer ke server AZOBSS. Harga dan stok
akhir tetap disahkan pada kedai sumber.

Validation:
- `node --check assets/js/azobss-pc-retailers.js` lulus.
- `node --test tests/pc-retailers.test.cjs`: 8/8 lulus.
- Full suite baseline v1427: 46 kegagalan lama akibat assertions package version lama.
- Full suite v1428: kegagalan sama 46; tiada regression tambahan daripada patch ini.
