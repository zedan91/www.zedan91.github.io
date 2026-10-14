# AZOBSS v1314 — Debt & Loan No-Slide + Manual +/- + Editable Due Date

Tarikh: 14 Oct 2026

## Perubahan utama

- `Admin > Sales & Receipts > Debt & Loan`
- Senarai hutang tidak lagi memaksa jadual `min-width:980px`; semua kolum boleh dilihat tanpa horizontal slide pada desktop.
- Di skrin kecil, setiap row bertukar kepada card/grid supaya masih tidak perlu slide kiri/kanan.
- Setiap hutang mempunyai due-date input terus dalam senarai. Ubah tarikh dan ia terus disimpan.
- Setiap hutang mempunyai `− Tolak / Bayar`, `＋ Tambah`, `Edit`, dan `Reset Sync` atau `Delete`.
- Rekod sejarah membezakan `−` pembayaran/tolak dan `+` tambahan hutang.
- Untuk fixed schedule Loan Kereta dan SLoan, bayaran cukup satu ansuran akan kurangkan remaining installment dan gerakkan due date ke bulan seterusnya.
- SPayLater kekal menggunakan purata bulanan kerana jumlah instalment boleh berbeza; auto-capture Shopee boleh overwrite baki sebenar.

## Baseline kewangan v1314

- Loan Kereta AmBank: baki RM11,896.15, RM479/bulan, due 14hb, next due 14 Nov 2026.
- SPayLater: total RM3,469, 22 bayaran berbaki, purata RM157.68/bulan, due 1hb, next due 1 Nov 2026.
- SLoan: RM397/bulan, 18 bulan berbaki, anggaran jadual baki RM7,146, due 11hb, next due 11 Nov 2026.
- Nava Shankara: RM600.
- Omar bin Akasah: RM5,000.

Jumlah baseline semua hutang: **RM28,111.15**
Komitmen bulanan finance diketahui: **RM1,033.68**

Data v1313 dimigrasi ke storage v1314. Jika SPayLater/SLoan sudah mempunyai sync Shopee yang lebih baharu, migration tidak menimpa balance sync tersebut.
