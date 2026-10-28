# AZOBSS Patch 934 — DXF AutoCAD 2000 compatibility + DWG Render self-install

## Isu dibetulkan
1. DXF daripada v932/v933 menggunakan header AutoCAD R12 (`AC1009`) tetapi layer `PER NDCDB` mengandungi ruang. Sesetengah AutoCAD/SurveyCAD lama menolak nama symbol-table tersebut dan memaparkan `Improper table entry name PER NDCDB`, lalu drawing dibuang/kosong.
2. Butang DWG boleh memaparkan `DWG converter belum tersedia pada Render` apabila LibreDWG gagal dibina semasa `npm postinstall`.

## Pembetulan v934
- DXF kini ditulis sebagai **AutoCAD 2000 / AC1015** dengan TABLES/BLOCK_RECORD/BLOCKS dan subclass marker yang sah.
- Nama layer tepat dikekalkan: `PER NDCDB`, `NOLOT`, `NOPA`.
- Unit DXF ditetapkan kepada meter (`$INSUNITS=6`).
- Geometri kekal **LINE sahaja**, tiada LWPOLYLINE/POLYLINE.
- Setiap lot kekal mempunyai `NOLOT` dan `NOPA`; PA berada di bawah nombor lot dengan saiz teks sama.
- Cache CAD menggunakan converter version `934.1`, jadi DXF v932/v933 yang rosak tidak akan digunakan semula.
- Pemasangan LibreDWG diperkukuh dengan `--disable-werror`, `-Wno-error`, retry compile single-thread, fallback direct binary copy dan self-check.
- LibreDWG kini dicuba pada `postinstall`, `prestart`, startup `deploy-server.js`, dan sebagai fallback sebelum permintaan DWG ditolak.
- Log pemasangan berada di `.azobss-libredwg/install-status.log` pada Render.

## Ujian sample LotKadasterBerdigit.zip
- DXF version: AC1015
- LINE `PER NDCDB`: 16,990
- TEXT `NOLOT`: 4,964
- TEXT `NOPA`: 4,964
- LWPOLYLINE/POLYLINE: 0
- ezdxf audit: 0 error / 0 fix

## Deployment
Render backend perlu redeploy supaya converter v934 dan installer LibreDWG baharu digunakan.
