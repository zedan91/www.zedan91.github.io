# AZOBSS Patch 798

Menjadikan rekod Tempah Servis IT sebagai **Service Order / Draft Invoice source** yang quota-safe. Admin boleh simpan harga akhir, membuka draf invois yang telah dipraisi dalam Sales & Receipts, memautkan invois ke tempahan, dan menyelaraskan status paid/receipt selepas ToyyibPay mengesahkan bayaran. Senarai tempahan menggunakan cache 90 saat serta had 120 rekod untuk mengurangkan Firestore reads.
