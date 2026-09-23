# AZOBSS Patch 1152 — Lot Kadaster Stale Job Recovery

Patch ini membetulkan kes muat turun Lot Kadaster Berdigit yang loading lama selepas pembelian dibiarkan beberapa lama.

- Probe direct ZIP dibuat dahulu sebelum semakan status GP job, supaya ZIP lama yang masih sah boleh terus dimuat turun walaupun ArcGIS telah membersihkan job.
- Status terminal `esriJobFailed`, `esriJobCancelled`, `esriJobTimedOut`, `esriJobDeleted` tidak lagi disamar sebagai HTTP 202 `Tengah Proses`.
- Backend kini memulangkan 409/410 untuk job terminal yang tidak boleh dipulihkan.
- Pembelian baharu menyimpan ID lot tepat yang telah dibayar (`lotSelectedObjectIds`) supaya job yang dipadam boleh dijana semula secara automatik tanpa mengubah bentuk/pilihan lot.
- Jika job lama terminal dan data regenerasi tersedia, backend mencipta job baharu, mengemas kini purchase record yang sama dan meneruskan polling tanpa menggunakan kuota download.
- Rekod legacy tanpa ID lot regenerasi berhenti cepat dengan mesej jelas, bukan spinner sehingga ~13 minit.
- Foreground prepare polling dihadkan 3 minit; final download preparing polling dihadkan 2 minit.
- Background readiness polling berhenti selepas 72 semakan (~6 minit) dan boleh bermula semula apabila pengguna menekan Download.
- Cache buster PA/BM dinaikkan ke v1152.
