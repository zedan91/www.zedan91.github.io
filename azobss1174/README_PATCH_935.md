# AZOBSS Patch 935 — DXF visible on open + reliable DWG Docker runtime + table spacing

## Masalah yang dibetulkan

1. **DXF boleh dibuka tetapi kelihatan kosong.**
   - Data sebenarnya wujud tetapi v934 menggunakan DXF minimum tanpa extents/view yang cukup kuat untuk sesetengah AutoCAD/SurveyCAD.
   - v935 menggunakan template penuh AutoCAD 2013 (`AC1027`) yang dihasilkan oleh ezdxf, kemudian memasukkan entity Lot Kadaster ke Model Space.
   - `$EXTMIN/$EXTMAX`, drawing limits dan `*Active` viewport ditetapkan berdasarkan extents lot sebenar supaya drawing dibuka terus pada kawasan data.

2. **DWG converter masih tidak tersedia pada Render native Node runtime.**
   - v935 menambah `Dockerfile` dan menukar root `render.yaml` kepada `runtime: docker`.
   - Image memasang toolchain OS yang diperlukan, membina LibreDWG daripada release rasmi yang checksum-nya disahkan, dan menjalankan smoke-test DXF -> DWG semasa Docker build.
   - Docker build sengaja gagal jika `dxf2dwg` tidak benar-benar boleh menghasilkan fail DWG. Ini mengelakkan deploy nampak berjaya tetapi butang DWG tetap gagal.

3. **Kolum Tempoh terlalu hampir dengan butang ZIP/DWG/DXF.**
   - Lebar `Tempoh` dikecilkan dan dialihkan ke kiri melalui grid layout.
   - Kolum `Tindakan` diberi minimum ruang lebih besar supaya ZIP/DWG/DXF + kaunter + Reset tidak bertindih.

## Struktur CAD kekal

- `PER NDCDB` — putih, semua sempadan sebagai entity **LINE** individu.
- `NOLOT` — putih.
- `NOPA` — kuning.
- Setiap lot mempunyai nombor PA di bawah nombor lot dengan saiz text yang sama.
- Tiada `LWPOLYLINE` atau `POLYLINE` dijana.

## Ujian sample LotKadasterBerdigit.zip

- 4,964 `NOLOT`
- 4,964 `NOPA`
- 16,990 `LINE`
- 0 polyline
- DXF: AutoCAD 2013 / AC1027
- ezdxf audit: 0 error, 0 fix
- `$EXTMIN/$EXTMAX` dan active viewport sepadan dengan lokasi drawing sebenar.

## Render

Untuk mengaktifkan DWG, service `azobss-backend` mesti menggunakan Docker runtime v935. Root `render.yaml` dan `Dockerfile` sudah disediakan. Jika service tidak diurus melalui Blueprint, tukar Runtime service kepada Docker sekali di Render Dashboard dan redeploy.

## Health check

Selepas deploy, buka `/api/lot-cad/health`. Untuk deployment yang betul, `formats.dxf` dan `formats.dwg` mesti `true`, dan `patch` mesti `935`.
