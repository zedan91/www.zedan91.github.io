# AZOBSS Patch v936 — Render Docker LibreDWG `libtool` preflight fix

## Punca sebenar deploy v935 gagal
Render Docker log menunjukkan:

`[AZOBSS LibreDWG] Required build tool 'libtool' is unavailable.`

Pada Debian/Bookworm, pakej `libtool` menyediakan utiliti **`libtoolize`**. Fail `libtool` yang digunakan ketika kompilasi pula dijana secara lokal oleh `./configure`. Oleh itu semakan `command -v libtool` dalam v935 adalah semakan yang salah dan menyebabkan build dihentikan walaupun pakej libtool sudah dipasang.

## Perubahan v936
- Preflight installer kini memeriksa `libtoolize`, bukan `libtool`.
- Docker turut memasang `libtool-bin`, `m4`, `gzip` dan `zlib1g-dev` untuk build LibreDWG yang lebih tahan lasak.
- Compile LibreDWG ditetapkan **1 job** untuk mengurangkan penggunaan RAM semasa build.
- `AZOBSS_LIBREDWG_BUILD_JOBS=1` ditambah dalam Docker/Blueprint.
- Converter/cache version dinaikkan ke **936.1**.
- `/api/lot-cad/health` akan melaporkan `patch: "936"`.

## Selepas upload
Commit semua fail v936 ke branch `main`. Oleh sebab service kini `Blueprint managed` + Docker, Render sepatutnya sync/deploy secara automatik. Jika tidak, tekan **Manual sync** pada Blueprint.

Selepas deploy berjaya, semak:
`https://azobss-backend.onrender.com/api/lot-cad/health`

Target:
- `formats.zip = true`
- `formats.dxf = true`
- `formats.dwg = true`
- `dwgConverter = ready`
- `converterVersion = 936.1`
- `patch = 936`
