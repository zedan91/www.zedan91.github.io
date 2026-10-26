# PA/BM — status troli selepas pembayaran

Asas: ZIP manual pemilik (1435), diperiksa penuh sebelum suntingan.

Bayaran yang disahkan oleh backend terus ditunjukkan sebagai berjaya sebelum
menunggu kemas kini troli atau senarai pembelian ke cloud. Kegagalan/lengah
proses tersebut tidak menukar status menjadi “menyambung semula pengesahan”.
Troli menunjukkan pautan Lihat pembelian & muat turun. Kejayaan kekal sehingga
pelanggan sengaja menambah item baharu. Pengesahan berulang bagi transaksi
yang sama tidak mengosongkan troli baharu.

Permintaan semakan mempunyai had masa 12 saat. Cubaan automatik berhenti
selepas tetingkap dua minit. Status yang masih tidak diketahui mengekalkan
rujukan pesanan dan menawarkan Semak Semula Status Bayaran, sambil menerangkan
agar pelanggan tidak membayar semula jika akaun bank sudah didebit.
Keadaan ini tidak dilabel sebagai bayaran gagal. Pengesahan semula tidak
menghasilkan bil atau caj baharu. Status berjaya hanya ditetapkan selepas
respons backend yang berjaya; parameter URL sahaja tidak mencukupi.

Ralat sintaks sedia ada dalam azobss-pabm-storefront.js turut diperbaiki:
ungkapan campuran && / ?? diberi kurungan supaya modul boleh dimuatkan.
PA-BM memuatkan kedua-dua runtime dengan cache-buster 1436.

Tiada perubahan pada gateway pembayaran, harga, pemilikan rekod, API backend
atau syarat akses muat turun. Tiada bayaran/customer order sebenar digunakan
dalam ujian. Ujian browser menggunakan fixture setempat dengan respons contoh
dan kemas kini cloud yang sengaja dibiarkan tergantung.
