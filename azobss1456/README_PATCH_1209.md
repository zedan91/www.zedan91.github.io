# AZOBSS v1209 — Sambungan AZDM dan susunan tab

Pakej lengkap ini merangkumi semua perubahan v1207 dan v1208.

- Dalam Admin → Software Key, butang **AZDM di kiri** dan **SurveyCAD di kanan**.
- SurveyCAD kekal sebagai tab default dan semua rekod/fungsi asal dikekalkan.
- Sambungan pengurusan lesen menggunakan backend Render dan Cloudflare sedia ada. Kod akses tidak dimasukkan dalam ZIP, HTML atau JavaScript browser.
- Backend membersihkan ruang kosong/newline di hujung kod akses yang disalin, supaya kod yang betul tidak gagal kerana format salinan.
- Blueprint Render menyatakan `AZDM_ADMIN_TOKEN` sebagai secret `sync: false` dan menetapkan URL Cloudflare sedia ada.

## Tetapan sebenar dalam kemas kini ini

`AZDM_ADMIN_TOKEN` sudah disimpan pada Environment servis `azobss-backend` di Render menggunakan kod akses AZDM sedia ada. Render berjaya deploy semula. Kod signing lesen dan database asal tidak diubah.

Semakan menggunakan sesi admin AZOBSS sebenar berjaya memuatkan rekod lesen AZDM melalui Render. Mesej sambungan belum ditetapkan sudah hilang. Rekod SurveyCAD juga berjaya dimuatkan. Susunan AZDM kiri/SurveyCAD kanan disahkan pada website yang telah diterbitkan.

Susunan dua tab juga dikemas kini pada repositori website melalui perubahan khusus pada `admin/index.html`; fungsi SurveyCAD tidak diubah dalam perubahan tersebut.

Jika memindahkan website ke servis Render baru, tetapkan secret yang sama melalui Render Environment. Jangan masukkan nilainya dalam kod atau repositori. URL default kekal `https://azdm-license.zedan9107.workers.dev`.

## Penggunaan

1. Login AZOBSS sebagai admin/owner yang dibenarkan.
2. Buka Admin → Software Key → AZDM.
3. Tekan Refresh untuk muatkan lesen sedia ada.
4. Tab SurveyCAD di kanan mengurus rekod SurveyCAD seperti sebelumnya.

Senarai pesanan dan penghantaran email automatik masih memerlukan persediaan ToyyibPay/email/Worker yang diterangkan dalam `README_PATCH_1207.md`. Menyambungkan admin lesen tidak mengaktifkan pembayaran atau menghantar email customer.

Semakan live mendapati endpoint pesanan Cloudflare masih menjawab `Not found`. Ini berasingan daripada sambungan pengurusan lesen yang sudah berjaya.

## Semakan

- 10 ujian backend pembelian dan admin lulus.
- Paparan desktop dan telefon, susunan tab, carian/pagination, dialog serial, Edit, Reset PC, Sekat/Buka sekatan, keyboard dan pertukaran akaun lulus dalam simulasi.
- Server tempatan menolak permintaan admin tanpa login dan mengekalkan endpoint SurveyCAD asal.
- Tiada lesen customer production diubah, serial production baru dikeluarkan atau email customer dihantar semasa kerja ini.

ZIP v1209 disimpan terus dalam `C:\Users\MSI\Downloads\Github Zip Store`. Tiada pakej diextract ke folder tersebut. Rujuk fail audit/verification untuk bukti semakan dan status penerbitan.
