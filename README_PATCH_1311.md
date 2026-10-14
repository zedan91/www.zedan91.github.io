# AZOBSS v1311 — Upgrade & Parts Deep-Link Fix

Date: 2026-10-14
Package: 1.0.1311
Baseline: v1310

## Masalah
Klik `PC & IT Services > Upgrade & Parts` boleh berakhir di `/PC-IT-Services/` tanpa membawa pengguna ke kad Upgrade & Parts. Pada sesetengah keadaan hash `#upgrade-parts` ada di URL tetapi halaman masih berada di bahagian atas.

## Fix
- Pautan kekal canonical sebagai `/PC-IT-Services/#upgrade-parts`.
- Jika klik dari halaman lain, browser membuka halaman PC & IT Services dengan hash tersebut.
- Jika klik semasa sudah berada di `/PC-IT-Services/`, navigation dibuat tanpa reload dan hash `#upgrade-parts` dikekalkan.
- Selepas hash aktif, halaman akan scroll tepat ke kad `Upgrade & Parts`, mengambil kira tinggi sticky navbar.
- Deep-link yang dibuka terus atau selepas refresh turut realign selepas DOM/layout siap supaya tidak tersangkut di `Pilih servis`.
- Active state submenu `Upgrade & Parts` diselaraskan terus selepas klik/hash berubah.
- Cache-buster `azobss-more-nav.js` dinaikkan kepada `v=1311` pada semua halaman yang menggunakannya.

Tiada perubahan pada servis, harga, booking atau fungsi lain.
