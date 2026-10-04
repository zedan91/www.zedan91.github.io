# AZOBSS Patch 941 — Fast Render Docker Deploy Cache + Build Filter

## Tujuan
Mempercepat deploy `azobss-backend` selepas fungsi DWG memerlukan Docker + LibreDWG.

## Punca deploy v940 lambat
`package.json` dinaikkan versinya pada hampir setiap patch. Dalam v940, `npm install` menjalankan `postinstall` yang memanggil `scripts/install-libredwg.sh`, jadi perubahan kecil pada package metadata boleh memaksa build LibreDWG yang mahal berulang. Selain itu, semua commit repo boleh mencetuskan auto-deploy backend walaupun hanya frontend berubah.

## Perubahan v941
1. LibreDWG dibina dalam Docker layer awal dan stabil, sebelum `package.json` dan sebelum `COPY . .`.
2. `postinstall` dan `prestart` LibreDWG dibuang daripada `package.json`; disediakan `npm run libredwg:install` untuk penggunaan manual sahaja.
3. `npm install` berada dalam layer berasingan selepas converter siap.
4. Source aplikasi disalin paling akhir supaya perubahan biasa menggunakan semula layer OS + LibreDWG + npm yang dicache.
5. `render.yaml` menambah `buildFilter.paths` untuk fail backend/runtime sahaja. Edit frontend biasa tidak lagi auto-deploy `azobss-backend`.
6. Fungsi DWG/DXF/ZIP dan pembetulan posisi teks v940 tidak diubah.

## Nota penting
- Deploy pertama v941 masih boleh mengambil masa kerana Dockerfile berubah dan layer LibreDWG perlu dibina sekali lagi.
- Deploy seterusnya sepatutnya jauh lebih cepat selagi `Dockerfile`, `scripts/install-libredwg.sh` dan `scripts/dwg-smoke-test.dxf` tidak berubah.
- Jangan gunakan **Clear build cache & deploy** kecuali benar-benar perlu kerana ia membuang layer cache.
- `render.yaml` sendiri sentiasa diproses oleh Blueprint walaupun build filter ada.

Package: `1.0.941`  
CAD converter/cache: `940.1` (dikekalkan supaya cache CAD v940 tidak dibuang)  
Health patch: `941`
