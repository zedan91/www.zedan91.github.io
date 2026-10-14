# AZOBSS v1316 — Debt Table Money Single-Line Layout Fix

- Betulkan nilai wang dalam **Admin > Debt & Loan > Senarai Hutang** yang pecah seperti `RM11,` pada baris pertama dan `896.15` di baris kedua.
- Nilai baki kini dibungkus dalam `.az-debt-money-line` dengan `white-space: nowrap`, `word-break: normal` dan angka tabular supaya `RM11,896.15` kekal satu baris.
- Kolum **Baki** dan **Bulanan / Due** diberi ruang lebih besar (14% setiap satu) sambil mengekalkan jadual tanpa horizontal slide.
- Nilai bulanan juga dipaksa satu baris.
- `word-break: break-word` global pada sel jadual dibuang untuk mengelakkan nombor dipotong di tengah.
- Version badge dan cache-buster shared auth dinaikkan ke `v1316`.
- Semua fungsi v1315/v1314 termasuk due date edit, manual tambah/tolak, SPayLater/SLoan sync dikekalkan.
