# AZOBSS Patch 892 — Correct SurveyCAD ID Mapping & Remove Onetimecode

## Pembetulan

- Admin > Software Key tidak lagi memaparkan, mencari, mengeksport atau meminta `Onetimecode`.
- Manual Add kini mewajibkan `Key Serial`; `Onetimecode` telah dibuang sepenuhnya.
- Backend hanya menerima `System ID` dan `Systemcode` yang tepat 12 digit, bukan nombor default berulang, dan kedua-duanya mesti berbeza.
- Status `Lengkap` kini bergantung pada `Key Serial` sebenar sahaja.
- Medan `oneTimeCode` lama dibersihkan apabila rekod yang sama dikemas kini.

## Pasangan dengan AZOBSS Installer v211

- Pembaca UI memadankan nilai berdasarkan baris/kedudukan visual.
- Pembaca memori melokasikan satu blok lengkap tiga nilai berhampiran label `System ID` dan `Systemcode`, kemudian mengambil dua nilai pertama mengikut urutan sebenar.
- Pasangan separa baris kedua + ketiga tidak lagi diterima sebagai `System ID` dan `Systemcode`.
- `Onetimecode` tidak lagi dibaca atau dihantar.
