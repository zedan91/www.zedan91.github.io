# Patch 1271 — Lot Kadaster `prepared` TDZ Runtime Fix

- Membetulkan runtime error `can\'t access lexical declaration 'prepared' before initialization` dalam modal Lot Kadaster.
- Punca tepat: patch fast-path v1269 menambah `routeLabel = prepared && prepared.fastExactFeatureSet` di dalam `updateProcessingUi()`, tetapi `updateProcessingUi()` dipanggil sebelum deklarasi `let prepared = await ...`. Ini ialah JavaScript Temporal Dead Zone (TDZ), bukan masalah JUPEM/Firebase.
- `prepared` kini dideklarasikan sebagai `let prepared = null` sebelum `updateProcessingUi()` diwujudkan/dipanggil, kemudian diassign selepas `/api/jupem-lot-selection/prepare` selesai.
- Fast-path 1–100 lot v1269 dikekalkan; selepas response prepare diterima, UI masih boleh memaparkan label `Laluan pantas lot terpilih`.
- Cache `azobss-lot-selection-map.js` dan early bridge dibump ke v1271 supaya browser tidak guna JS v1269/v1270 yang rosak.
- Cart, checkout, Admin Test Payment v1270, auth hydration v1268, server cart draft dan backend lain tidak diubah.
