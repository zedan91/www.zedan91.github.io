# AZOBSS Patch v937 — LibreDWG lean DXF smoke/runtime profile fix

Punca log Render v936: Docker berhenti pada langkah verifikasi `dxf2dwg` (exit code 1) selepas pemasangan. v937 mengasingkan DXF pengguna dan DXF dalaman untuk LibreDWG.

- DXF pengguna kekal AutoCAD 2013/AC1027 penuh dengan viewport/extents.
- DWG tidak lagi menukar fail AC1027 penuh itu secara terus. Backend membina DXF dalaman AC1015/R2000 yang lean (HEADER/TABLES/BLOCKS/ENTITIES sahaja) tetapi mengekalkan semua LINE/TEXT dan layer `PER NDCDB`, `NOLOT`, `NOPA`.
- Smoke test Docker juga ditukar kepada DXF R2000 ringkas tanpa CLASSES/OBJECTS.
- Docker kini mencetak log sebenar pemasangan/smoke jika gagal supaya error seterusnya tidak lagi tersembunyi di dalam satu rangkaian `&&`.
- `--enable-write` yang tidak diperlukan dibuang; write support LibreDWG memang aktif secara default.
- Converter/cache version: 937.1. Health patch: 937.

Selepas commit ke `main`, sync/redeploy Blueprint. Sasaran `/api/lot-cad/health`: `dwg: true`, `dwgConverter: dxf2dwg-ready`, `converterVersion: 937.1`.
