# AZOBSS Patch 890 — JUPEM eBiz Single Session Auto Takeover Fix

## Punca sebenar
JUPEM eBiz kini menguatkuasakan satu sesi login aktif bagi satu akaun.
Jika akaun sedang aktif pada browser/peranti lain, halaman selepas ID pengguna
memaparkan modal:

- `Sesi Sedia Ada Dikesan`
- `Akaun ini sedang aktif di tempat lain`
- `Teruskan di sini`

Jika diteruskan, sesi lama akan ditamatkan.

## Fix
- Backend mengesan modal sesi sedia ada sebelum pengesahan frasa/kata laluan.
- Auto pilih `Teruskan di sini`.
- Preserve cookie, hidden field, CSRF dan form action.
- Sokong button/form, anchor, `formaction`, `data-url`, `data-href`,
  serta beberapa corak `onclick`/JavaScript URL.
- Selepas takeover, backend sambung:
  `ID Pengguna -> Frasa Keselamatan (Ya) -> Kata Laluan -> Dashboard/Troli`.
- Semakan takeover juga dibuat selepas frasa dan selepas password kerana JUPEM
  boleh memaparkan modal pada peringkat berbeza.
- `JUPEM_EBIZ_AUTO_TAKEOVER_SESSION=false` boleh digunakan jika tidak mahu
  backend menamatkan sesi manual yang sedang aktif.
- Default auto takeover = `true`.
- Username/password tidak dimasukkan ke log.
- `jupemStoreVersion` = 36.

## Penting
Apabila backend memilih `Teruskan di sini`, sesi JUPEM yang sedang terbuka pada
browser/peranti lain akan ditamatkan. Ini memang tingkah laku keselamatan JUPEM.

## Deploy
Render backend wajib redeploy.
