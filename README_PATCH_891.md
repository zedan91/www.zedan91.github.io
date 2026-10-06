# AZOBSS Patch 891 — Software Key Auto-Save Reliability Fix

## Punca rekod tidak muncul

Backend lama hanya menyimpan rekod selepas `Key Serial` atau `Onetimecode`
berjaya diperoleh. Jika AZOBSS Installer sudah membaca `System ID`,
`Systemcode` dan `Motherboard ID` tetapi key masih belum tersedia, keseluruhan
rekod ditolak dan Admin kekal menunjukkan `0 rekod`.

## Fix backend

- `POST /api/software-keys/capture` kini menyokong simpanan dua peringkat.
- Peringkat `identifiers` menyimpan `System ID`, `Systemcode`, `Motherboard ID`
  dan maklumat PC dahulu sebagai `pending-key`.
- Apabila key diterima, rekod Firestore yang sama dikemas kini kepada
  `complete`; rekod pendua tidak dicipta.
- Key sedia ada tidak dipadam jika permintaan susulan tidak membawa key.
- Nama medan lazim seperti `systemCode`/`systemcode`,
  `motherboardId`/`motherboardID` dan `serialKey`/`keySerial` dinormalkan.
- Manual Add kekal mewajibkan Onetimecode atau Key Serial.
- Koleksi Firestore kekal `softwareKeyRecords`.

## AZOBSS Installer v204

- Selepas `System ID`, `Systemcode` dan `Motherboard ID` dibaca, Installer
  menghantar rekod peringkat `identifiers` dengan segera.
- Selepas key diperoleh, Installer menghantar peringkat `complete` untuk
  mengemas kini rekod yang sama.
- Penghantaran ke Render mencuba sehingga tiga kali dengan timeout 60 saat
  bagi mengendalikan cold start backend.
- Local JSON backup kekal di `%ProgramData%\AZOBSS\SoftwareKeys`.

## Fix Admin > Software Key

- Rekod belum mempunyai key ditanda `Menunggu key`.
- Rekod lengkap ditanda `Lengkap`.
- Ditambah kiraan rekod yang masih menunggu key.
- Tab aktif auto-refresh setiap 10 saat supaya rekod Installer muncul tanpa
  perlu menekan Refresh.
- Status turut dimasukkan dalam Export CSV.

## Deploy

Render backend wajib redeploy menggunakan ZIP patch ini, kemudian publish fail
website. Gunakan `AZOBSS_Installer.bat` v204 atau lebih baharu untuk aliran
dua peringkat. Tiada Environment Variable baharu diperlukan.
