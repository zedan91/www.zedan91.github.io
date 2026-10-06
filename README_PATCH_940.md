# AZOBSS Patch 940 — DWG Lot/PA Text Position Fix

Tarikh: 17 Ogos 2026

## Punca
DXF awam AC1027 menggunakan entity `TEXT` dengan middle-centre alignment (`72=1`, `73=2`) dan alignment point `11/21`. DXF ini dipaparkan betul oleh AutoCAD, tetapi LibreDWG `dxf2dwg` 0.14.x boleh menukar aligned TEXT ke DWG dengan insertion/alignment point yang salah. Kesan yang dilihat ialah nombor lot/PA berkumpul jauh daripada lot, walaupun garisan lot berada di tempat betul.

## Pembetulan
- DXF yang dimuat turun pengguna **tidak diubah** dan kekal AC1027 dengan alignment asal.
- Hanya DXF dalaman yang digunakan untuk menghasilkan DWG dinormalisasi.
- `TEXT` dalaman ditukar kepada left/baseline alignment (`72=0`, `73=0`).
- Group `11/21/31` alignment point dibuang untuk mengelakkan LibreDWG memindahkan teks.
- Insertion point `10/20` dipra-offset berdasarkan tinggi dan panjang teks supaya kedudukan visual kekal hampir sama dengan middle-centre asal.
- Layer dan saiz teks kekal: `NOLOT` putih, `NOPA` kuning, PA di bawah nombor lot, saiz PA sama dengan lot.
- Garisan `PER NDCDB` kekal semua entity LINE.

## Versi
Package: `1.0.940`  
CAD converter/cache: `940.1`  
Health patch: `940`
