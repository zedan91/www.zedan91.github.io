# AZOBSS v1450 — Liyabudun 1.0.48 + Software Pin Order

Base: `(1449) AZOBSS-FULL-WEBSITE-LIYABUDUN-INSTALLER-FIX-1.0.48_20261027_225400.zip`

## Perubahan
- Kekalkan semua pembaikan Liyabudun installer **v1.0.48** daripada baseline latest.
- Naik taraf `Featured / Pin to Top` di `/Software-Tools/` dengan **Pin Order**.
- `1` = card paling atas, `2` = kedua, `3` = ketiga, sehingga `999`.
- Semua pinned card sentiasa berada di atas card biasa, sebelum sort Newest / Rating / Downloads / Likes / A-Z / Z-A.
- Jika pin diaktifkan tetapi Pin Order dikosongkan, sistem auto-assign selepas pin terakhir.
- `pinOrder` disimpan dalam Firestore / local JSON export-import.
- Alias legacy disokong: `featuredOrder`, `pinPriority`, `pinnedOrder`, `featuredPriority`.
- Card menyimpan `data-pin-order` untuk sorting visual/static.
- Cache Software Tools dan bundled directory dinaikkan ke `v1450`.
- Global version badge dinaikkan ke `v1450`.

## Semakan
- Liyabudun installer masih: `https://files.azobss.com/liyabudun/releases/1.0.48/Liyabudun_Setup.exe`
- Meta card Liyabudun masih `v1.0.48`.
- 66 inline JavaScript blocks `/Software-Tools/` lulus `node --check`.
- `assets/js/azobss-global-auth.js` lulus `node --check`.
- ZIP lulus integrity test.
