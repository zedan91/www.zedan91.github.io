AZOBSS Shopee Browser Capture v1313

Fungsi:
1. Affiliate Shop: capture metadata produk seperti v1309.
2. Admin > Debt & Loan: capture ringkasan SPayLater/SLoan secara lokal untuk auto reconcile baki.

Install / update:
1. Chrome/Edge > Extensions > Developer mode.
2. Jika versi lama sudah ada, tekan Reload selepas replace folder ini.
3. Jika belum ada, Load unpacked dan pilih folder azobss-shopee-json-extension.
4. Buka AZOBSS Admin > Debt & Loan; status mesti tunjuk Extension v1313 ready.
5. Buka Shopee web dalam browser yang sama dan login sendiri.
6. Pergi ke halaman SPayLater atau SLoan. Bila angka finance kelihatan, extension akan capture field terpilih sahaja.
7. Kembali ke Admin > Debt & Loan. Baki akan reconcile; jika baki turun, beza direkod sebagai bayaran automatik.

Privacy:
- Extension tidak membaca atau menghantar password/cookie Shopee kepada AZOBSS.
- Hanya field ringkasan seperti baki, current due, due date, remaining installment dan timestamp dihantar melalui browser storage lokal.
- Jika halaman Shopee web tidak memaparkan finance data, guna fallback paste text atau edit manual dalam Debt & Loan.
