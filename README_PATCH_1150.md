# AZOBSS Patch 1150 — Download Spinner Until File Handoff

Tarikh: 17 September 2026

## Tujuan
Memastikan spinner pada `/PA-BM/` > **Senarai Pembelian Terkini** tidak berhenti terlalu awal untuk download PA.

## Punca v1149
Spinner v1149 sudah kelihatan, tetapi flow PA masih menggunakan hidden iframe/native attachment. Fungsi itu menganggap download sudah bermula sebaik URL diberi kepada iframe, lalu `finally` memadam spinner walaupun backend/JUPEM masih menjana atau menghantar PDF.

## Perubahan v1150
- PA tidak lagi keluar awal melalui hidden iframe untuk laluan normal.
- PA menggunakan flow terkawal `fetch -> response.blob() -> ObjectURL -> a.download` yang sedia digunakan oleh download terkawal lain.
- Spinner kekal berpusing sepanjang backend bangun, fail dijana dan keseluruhan PDF dipindahkan ke browser.
- Spinner hanya dilepaskan selepas `a.click()` untuk fail sebenar dan dua paint frame + handoff pendek supaya browser sempat mendaftarkan download.
- Fallback sumber luar yang tidak menyokong CORS masih menggunakan hidden-frame fallback kerana browser tidak membenarkan JavaScript membaca fail cross-origin tersebut.
- Tiada perubahan kepada had 5 download, expiry 7 hari, idempotency `downloadAttemptId`, harga atau rekod pembelian.
- Cache-buster PA/BM dinaikkan ke `v=1150`.
- Package version: `1.0.1150`.

## Nota teknikal
Browser tidak memberikan API kepada website untuk mengetahui saat tepat fail sudah kelihatan dalam Downloads shelf atau sudah ditulis ke filesystem. Untuk laluan PA normal, v1150 memastikan syarat paling kuat yang boleh dikawal oleh website: spinner kekal aktif sehingga **semua bytes PDF sudah diterima** dan browser sudah menerima arahan download sebenar.
