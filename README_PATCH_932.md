# AZOBSS Patch 932 — Lot Kadaster ZIP + DWG + DXF

Tarikh: 17 Ogos 2026

## Perubahan utama

Rekod pembelian berbayar **Lot Kadaster Berdigit** dan **Lot Kadaster Berdigit C3** kini mempunyai tiga pilihan muat turun pada kolum **Tindakan**:

- **ZIP** — fail asal JUPEM, tanpa perubahan.
- **DWG** — AutoCAD DWG yang dijana daripada SHP/DBF Lot Kadaster.
- **DXF** — DXF berlayer sebagai format alternatif/compatibility.

## Struktur CAD AZOBSS

DXF/DWG dijana mengikut susunan yang telah diuji pada fail LotKadasterBerdigit.zip pengguna:

- `PER NDCDB` — putih; semua sempadan lot ialah entity **LINE individu**.
- `NOLOT` — putih; satu nombor lot bagi setiap lot.
- `NOPA` — kuning; satu `PAxxxxx` bagi setiap lot.
- Teks PA berada **di bawah nombor lot** dan menggunakan **saiz teks yang sama** dengan nombor lot.
- Shared boundary yang sama dinyahduplikasi untuk mengurangkan garisan bertindih.
- Converter tidak menghasilkan `LWPOLYLINE` atau `POLYLINE` untuk sempadan lot.

## Kuota download

Sistem 5 muat turun / 7 hari sedia ada dikekalkan. Setiap muat turun yang berjaya (ZIP, DWG atau DXF) menggunakan 1 slot kuota. Jika sumber JUPEM belum siap atau conversion gagal, kuota tidak digunakan.

## Backend / Render

Backend kini mempunyai `lib/azobss-lot-cad-converter.js` untuk membaca SHP/DBF terus daripada ZIP JUPEM dan menjana DXF tanpa kebergantungan npm GIS tambahan.

DWG dijana daripada DXF menggunakan `dxf2dwg`. `scripts/install-libredwg.sh` dipanggil melalui `postinstall` untuk membina helper itu secara lokal ke `.azobss-libredwg/bin/dxf2dwg`. Jika helper DWG gagal dibina, ZIP dan DXF masih kekal berfungsi dan butang DWG akan memaklumkan bahawa converter belum tersedia.

Fail CAD yang telah berjaya dijana dicache sementara pada backend supaya muat turun seterusnya untuk rekod/format yang sama tidak perlu convert semula.

## Cache frontend

`PA-BM/index.html` dinaikkan ke cache version `v=932` untuk:

- `azobss-global-auth.js`
- `azobss-firebase-live-likes-sync.js`
- `azobss-pabm-storefront.css`

## Deployment

Render backend perlu **redeploy** selepas patch ini supaya `postinstall` dan endpoint conversion baharu aktif.
