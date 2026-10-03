# AZOBSS Patch 919 — Rujukan Bulatan/Petak + Pilih Lot Ikut Kawasan

Tarikh: 15 Ogos 2026

## Perubahan

- `Rujukan Radius` dinaik taraf kepada **Rujukan Kawasan** dengan dua bentuk:
  - **Bulatan** — klik pusat dan titik tepi untuk menentukan radius.
  - **Petak** — klik pusat dan titik tepi untuk menentukan separuh sisi; petak kekal berorientasi utara/selatan.
- Ditambah checkbox **Pilih lot dalam kawasan rujukan**.
- Checkbox tidak ditanda secara default, jadi bulatan/petak hanya menjadi panduan visual dan tidak mengubah pilihan lot/harga.
- Jika checkbox ditanda, selepas bentuk siap geometri kawasan dihantar ke endpoint estimate sedia ada dan lot yang bersilang dengan kawasan tersebut menjadi pilihan aktif untuk kiraan lot, nisbah syit dan harga.
- Menukar kembali checkbox kepada OFF akan memulihkan pilihan polygon/segi empat manual jika masih ada; jika tiada, ringkasan pilihan dikosongkan.
- Memulakan alat polygon/segi empat manual akan mematikan pemilihan ikut kawasan rujukan secara automatik, tetapi bentuk rujukan yang telah siap boleh kekal sebagai panduan visual.
- `Padam Pilihan` turut memadam bentuk rujukan dan mematikan checkbox.
- Bacaan dinamik:
  - Bulatan: Radius, Diameter, Luas bulatan, Hektar/Ekar.
  - Petak: Pusat → sisi, Panjang sisi, Luas petak, Hektar/Ekar.
- Cache `azobss-lot-selection-map.js` dinaikkan kepada `v=919`.

## Nota teknikal

- Bulatan pilihan ditukar kepada polygon 72 sisi (langkah bearing 5°) sebelum dihantar ke backend, kerana endpoint pemilihan JUPEM menerima polygon.
- Petak dibina sebagai polygon 4 penjuru berpusat pada titik yang dipilih.
- Tiada perubahan backend diperlukan untuk patch ini; endpoint `/api/jupem-lot-selection/estimate` dan `/prepare` sedia ada terus digunakan.
