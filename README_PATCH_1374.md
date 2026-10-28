# AZOBSS v1374 — Ebook Compact Desktop Workspace

## Tujuan
Memadatkan `/Software-Tools/#ebook` supaya workflow Pantas boleh digunakan pada satu skrin desktop biasa tanpa perlu page scroll panjang.

## Perubahan
- Hero Publisher Lab dipadatkan; aliran 01→04 kekal tetapi menggunakan ruang menegak jauh lebih kecil.
- Form desktop ditukar kepada grid 2 kolum:
  - Asas Projek + Arah Penulisan di baris pertama.
  - Skala Ebook + bar tindakan di baris kedua.
- Input, select, mode cards, size cards, stage headers dan action buttons dipadatkan tanpa membuang field atau fungsi.
- Panel `Arahan AI Siap Guna` dipendekkan dan menggunakan tinggi responsif berdasarkan viewport.
- Mod `Pro` kekal boleh digunakan; Kawalan Ketepatan menggunakan grid desktop 4 kolum supaya tidak kembali menjadi form panjang.
- Tambah extra-tight layout apabila tinggi browser <= 850px.
- Mobile/tablet kekal menggunakan layout v1373 asal supaya kebolehgunaan sentuh tidak dikorbankan.
- Fast direct route/performance fixes v1373, RM19 lifetime, ToyyibPay, prompt engine dan arkib arahan dikekalkan.

## Cache
`Software-Tools/index.html` kini memanggil `/assets/css/azobss-software-ebook-v1374.css?v=1374` supaya browser tidak menggunakan CSS v1373 yang tersimpan dalam cache.
