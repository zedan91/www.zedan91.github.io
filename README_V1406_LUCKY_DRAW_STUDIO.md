# (1406) Lucky Draw Studio

Halaman /lucky-draw/ direka semula dengan tema emerald/emas, roda visual,
pentas pemenang, kemajuan minimum peserta, kira detik, hadiah bergambar,
langkah penyertaan, carian peserta terkini dan sejarah pemenang. Paparan
responsive; bunyi perlu diaktifkan oleh penonton, animasi menghormati reduced
motion dan polling tidak berjalan apabila halaman tersembunyi.

## Urus terus dari halaman Lucky Draw

Login sebagai admin AZOBSS dan tekan **Urus Lucky Draw** di kanan atas:

1. **Kempen**: tajuk, lencana, pengenalan dan pengumuman berasingan BM/English.
2. **Paparan**: Emerald Club, Royal Violet atau Midnight Blue; warna aksen,
   tempoh animasi 3–20 saat, konfeti, pilihan bunyi dan paparan senarai/sejarah.
3. **Penyertaan**: buka/jeda, wajib share atau tidak, minimum 1–10 produk
   berbeza dikongsi, minimum 1–20,000 peserta dan terma BM/English.
4. **Jadual**: manual atau bulanan; hari terakhir bulan atau hari 1–28,
   jam dan minit dalam waktu Asia/Kuala_Lumpur.
5. **Hadiah & Cabutan**: editor hadiah, beberapa gambar/URL, import/export JSON,
   Run Draw, Test Spin, reset dan export peserta sedia ada.
6. **Data & Audit**: rekod perkongsian dan cubaan penyertaan berganda sedia ada.

**Pratonton** mengubah browser admin sahaja; tutup panel untuk membatalkannya.
**Simpan tetapan** menerbitkan konfigurasi. Versi tetapan diperiksa supaya
seorang admin tidak menimpa perubahan admin lain secara senyap.

## Cabutan dan penyertaan

- Keputusan rasmi dipilih pada backend menggunakan crypto.randomInt, menggantikan
  formula deterministik lama. Tiada kawalan memilih nama pemenang atau berat rahsia.
- Semua akaun layak mempunyai satu peluang; roda menampilkan peserta terkini,
  sementara pemilihan rasmi menggunakan keseluruhan penyertaan layak bulan itu.
- Run Draw memerlukan admin yang disahkan dan minimum peserta. Permintaan
  serentak/ulang memulangkan pemenang sama. Parameter force tidak mengganti winner.
- Pemenang Firestore disimpan melalui transaksi bersama bacaan peserta/config.
  Join turut menyemak penutupan dan duplikasi dalam transaksi sebelum commit.
- Server menguatkuasakan pause, bulan semasa Malaysia, masa tutup dan syarat share.
  Syarat tidak boleh dipintas dengan mengaktifkan butang melalui browser.
- Test Spin hanya simulasi dan tidak menghantar permintaan memilih winner rasmi.
- Endpoint awam hanya mendedahkan nama/masa/keputusan yang perlu dipaparkan,
  tanpa telefon, e-mel, UID Firebase, IP atau fingerprint. Export admin kekal.
- Keputusan lama, peserta dan hadiah dikekalkan; tiada data produksi direset
  dalam kerja ini. Hadiah folder bulan lain tidak dianggap hadiah bulan semasa.

## Deployment dan penyimpanan

Ini satu ZIP website penuh; tiada PATCH berasingan. Kekalkan struktur asal repo.
Frontend menggunakan assets/css/azobss-lucky-draw-studio.css,
assets/js/azobss-lucky-draw-studio.js dan backend/lucky-draw-model.js.

**Backend Lucky Draw ialah servis berasingan**:
https://azobss-lucky-draw-api.onrender.com, menjalankan backend/server.js.
Backend utama azobss-backend untuk SolatTime sahaja tidak mencukupi untuk
tetapan ini. Auto-deploy servis Lucky Draw perlu mengambil perubahan dalam
backend/server.js, lucky-draw-model.js dan lucky-draw-settings.js.

Semakan sebelum penerbitan mendapati backend Lucky Draw menggunakan Firestore.
Tetapan baharu menggunakan koleksi private luckyDrawConfig/current melalui
Admin SDK sedia ada; tiada secret atau environment variable baharu diperlukan.
Jangan tambah akses write Firestore pada browser. Jika pemasangan lain menggunakan
JSON, settings disimpan di DATA_DIR/lucky-draw-settings.json; DATA_DIR mesti berada
pada disk kekal untuk bertahan selepas redeploy. Backup data sedia ada dikekalkan.

Jadual bulanan ialah best effort ketika servis hidup, termasuk semakan selepas
startup. Render percuma boleh tidur, maka masa cabutan tepat tidak dijamin pada
hosting yang tidur. Minimum tidak mencukupi tidak menghasilkan pemenang; kemasukan
tidak dibawa ke bulan baru secara automatik. Penyertaan dikira mengikut bulan asal.

Selepas deploy, GET /api/lucky-draw/settings perlu HTTP 200,
settingsProtocol:1. Panel akan menolak simpanan jika backend belum menyokong
settings. Sahkan semula konfigurasi sebelum menjalankan cabutan sebenar.

## Pengesahan dan rujukan

74 ujian lulus: 8 fungsi Lucky Draw (validasi, kalendar/leap year, satu peluang
setiap akaun, projection private, JSON atomik, draw serentak/idempoten dan konflik
revision Firestore) serta 66 regression SolatTime/AZDM/menu/pembelian.
Browser data contoh menguji desktop, telefon 390px, admin-only panel, simpan/reload,
tema/pratonton, pause, minimum/share pilihan, manual, BM/English dan Test Spin.
Tiada cabutan sebenar, penghantaran notifikasi atau e-mel pelanggan dilakukan.

Rujukan fungsi, dengan reka bentuk AZOBSS sendiri:
- https://wheelofnames.com/faq — tema, bunyi dan tempoh animasi.
- https://www.randompicker.com/support/faqs/ — konfigurasi kempen, rekod dan ketelusan.
