# AZOBSS Patch 942 — DWG AutoCAD RECOVER Warning Mitigation

Tarikh: 17 Ogos 2026

## Masalah
DWG yang dijana oleh LibreDWG `dxf2dwg` boleh dibuka dan kandungannya betul, tetapi AutoCAD memaparkan `Open Drawing - Damaged File` / `The drawing file requires recovery` setiap kali dibuka. DXF tidak mempunyai masalah ini.

## Pembetulan
- Pipeline DWG kini: internal AC1015 DXF -> `dxf2dwg` R2000 -> `dwgrewrite` R2000 -> download.
- `dwgrewrite` membaca DWG hasil pertama, menulis semula struktur DWG, kemudian membaca semula fail hasilnya sebagai verifikasi.
- Backend tidak lagi menghantar DWG jika sanitation/rewrite gagal.
- Docker smoke test menguji kedua-dua `dxf2dwg` dan `dwgrewrite`.
- Health endpoint melaporkan `dwgSanitizer: dwgrewrite-ready`.
- Kedudukan NOLOT/NOPA daripada v940 dan optimasi Docker/cache daripada v941 dikekalkan.

## Nota
LibreDWG masih bukan writer DWG Autodesk rasmi. Patch ini menambah canonical rewrite pass untuk mengurangkan amaran RECOVER, tetapi pengesahan akhir tetap perlu dibuat dengan AutoCAD sebenar.

Package: `1.0.942`  
CAD converter/cache: `942.1`  
Health patch: `942`
