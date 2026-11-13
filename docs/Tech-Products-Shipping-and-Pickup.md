# AZOBSS Tech Products — penghantaran dan pengambilan

Dalam Admin, buka **Sales & Receipts → Requests & Orders → Filters & tools → Shipping & Pickup Settings**. Semak preview sebelum menyimpan. Tetapan disimpan dalam Firestore. Isi alamat sebenar termasuk Tingkat 1 selepas menyemak dokumen premis. Buat masa ini, laman menggunakan pin yang diberikan dan kawasan Batu Caves / Gombak. Nama paparan lalai ialah AZOBSS.

Rekod ukuran menggunakan Product ID dan ukuran selepas pembungkusan. Masukkan berat, panjang, lebar, tinggi, jenis, fragile, arahan pengendalian dan kelayakan subsidi. Jika ukuran SKU belum lengkap, ukur bungkusan pesanan sebenar dalam dialog quotation. Kenderaan ditapis mengikut berat dan dimensi. Untuk bungkusan yang belum diukur bersama, sistem menggunakan tapak maksimum dan jumlah tinggi setiap kotak yang diletakkan rata. Untuk pesanan rapuh atau pengendalian khas, motosikal dikecualikan.

1. Pelanggan pilih penghantaran atau pickup dalam permintaan sedia ada. Pickup percuma dan tanpa alamat penghantaran.
   Buka **Pin penghantaran → Cari di Google Maps**, pilih lokasi, kemudian gunakan **Kongsi → Salin pautan** dan **Simpan pin** dalam borang. Alamat penuh tetap diperlukan, termasuk nombor unit jika ada. Admin boleh buka pin daripada dialog quotation penghantaran.
2. Untuk penghantaran, buka rekod dan pilih **Semak quotation penghantaran**. Masukkan harga item selepas diskaun. Dalam mod manual, semak kos semasa, tol dan surcaj dengan pembekal. Jika Google Routes tiada, masukkan jarak perjalanan yang anda sahkan melalui peta. Tanpa jarak sah, subsidi tidak digunakan.
3. Terbitkan sebut harga selepas mengesahkan stok. Pelanggan menerima jumlah dan caj dalam My Requests. Sebarang perubahan harga pelanggan memerlukan sebut harga baharu. Invois memerlukan kelulusan pelanggan dan semakan stok serta kadar.
4. Selepas bayaran disahkan melalui aliran Tech Products sedia ada, tandakan pickup sebagai **Ready for Pickup** apabila barang tersedia. Bagi penghantaran manual, rekod kurier dan nombor penjejakan melalui pesanan.
5. Jika tempahan API sudah dikonfigurasi, admin boleh menekan **Tempah rider Lalamove** untuk pesanan berbayar. Backend mendapatkan kadar baharu. Jika kos meningkat atau keputusan penghantaran tidak pasti, semak portal Lalamove sebelum mengambil tindakan lanjut. Gunakan **Kemas kini tracking Lalamove** untuk menarik status. Untuk kemas kini automatik, daftarkan webhook versi 3 pada `https://azobss-backend.onrender.com/api/pc-shop/lalamove-webhook` dalam Partner Portal produksi. Uji penerimaan tandatangan dan status sebelum mengaktifkan produksi.

Cadangan motosikal RM500/RM15, kereta RM500/RM25 dan van RM2,000/RM50 disimpan sebagai nilai awal. Subsidi bermula dalam keadaan belum aktif. Tetapkan jarak, kategori, SKU yang layak, rizab margin dan peratus margin sebelum menghidupkannya. Kelayakan bergantung pada harga item yang disahkan dan kos sumber yang tersedia. Kos dalaman kekal di admin.

## Environment backend Render

| Pemboleh ubah | Kegunaan |
|---|---|
| `PC_SHIPPING_GOOGLE_MAPS_BROWSER_KEY` | Pilihan: untuk Google Maps interaktif dalam borang. Gunakan kunci berasingan, hadkan kepada Maps JavaScript API dan referrer `https://www.azobss.com/*` serta `https://azobss.com/*`. Nilai ini dihantar kepada pelayar. Carian di Google Maps dan pautan Kongsi berfungsi tanpa kunci ini. |
| `PC_SHIPPING_GOOGLE_MAPS_KEY` | Kunci pelayan untuk Places API (New) dan Routes API. Hadkan kunci kepada API tersebut dan tetapkan kuota. |
| `PC_SHIPPING_LALAMOVE_MODE` | `sandbox` atau `production`. Kos sandbox tidak diterbitkan kepada pelanggan. |
| `PC_SHIPPING_LALAMOVE_KEY`, `PC_SHIPPING_LALAMOVE_SECRET` | Ambil daripada Partner Portal untuk persekitaran yang dipilih. |
| `PC_SHIPPING_LALAMOVE_MOTORCYCLE`, `PC_SHIPPING_LALAMOVE_CAR`, `PC_SHIPPING_LALAMOVE_VAN` | Kod `serviceType` Kuala Lumpur daripada City Info / Partner Portal. |
| `PC_SHIPPING_LALAMOVE_BOOKING` | `1` mengaktifkan tempahan produksi yang dimulakan oleh admin bagi pesanan berbayar. |

Simpan rahsia di Render Environment. Untuk pelancaran, lengkapkan alamat, masukkan ukuran produk sebenar, semak syarat subsidi, uji kadar dan kod kenderaan dengan akaun pembekal sebelum mengaktifkan tempahan. Tech Products kekal menggunakan pengesahan pindahan bank sedia ada. ToyyibPay untuk modul yang menggunakan gateway tersebut kekal di laluan masing-masing.

[Lalamove Malaysia — kenderaan dan muatan](https://www.lalamove.com/en-my/all-vehicle-pricing-detail) · [Lalamove API](https://developers.lalamove.com/) · [Google Routes](https://developers.google.com/maps/documentation/routes/compute_route_directions)
