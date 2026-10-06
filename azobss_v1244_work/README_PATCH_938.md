# AZOBSS Patch v938 — LibreDWG Python configure fix

Punca sebenar daripada Render deploy log v937 ialah `./configure` LibreDWG berhenti dengan `configure: error: no suitable Python interpreter found`. Build toolchain, GCC, libtool dan linker sebenarnya sudah lulus.

Perubahan v938:
- Tambah `--disable-python` pada konfigurasi LibreDWG. Python bindings/tests tidak diperlukan untuk utiliti `dxf2dwg`.
- Kekalkan `--disable-bindings`, `--disable-docs`, `--disable-shared` dan `--disable-werror`.
- Tidak memasang Python ke image supaya Docker kekal lebih ringan pada Render Free.
- Kekalkan lean AutoCAD R2000 smoke DXF dan DXF dalaman lean untuk proses DWG.
- Converter/cache version: 938.1. Health patch: 938.

Selepas commit ke `main`, sync/redeploy Blueprint. Sasaran `/api/lot-cad/health`: `zip=true`, `dxf=true`, `dwg=true`, `dwgConverter=dxf2dwg-ready`, `converterVersion=938.1`, `patch=938`.
